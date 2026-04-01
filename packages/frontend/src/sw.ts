/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();

// Precache Vite-built assets
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigation: serve app shell (SPA)
registerRoute(
  new NavigationRoute(
    new CacheFirst({
      cacheName: 'app-shell',
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
      ],
    })
  )
);

// API GET requests: StaleWhileRevalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && self.location.origin === url.origin,
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  }),
  'GET'
);

// Background sync for failed mutations
const bgSyncPlugin = new BackgroundSyncPlugin('bee-forest-sync-queue', {
  maxRetentionTime: 7 * 24 * 60, // 7 days
});

// POST/PUT/PATCH/DELETE to API: NetworkOnly + BackgroundSync
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && self.location.origin === url.origin,
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'POST'
);
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && self.location.origin === url.origin,
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'PUT'
);
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && self.location.origin === url.origin,
  new NetworkOnly({ plugins: [bgSyncPlugin] }),
  'DELETE'
);

// Static assets: CacheFirst
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Notify clients about new SW waiting
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
