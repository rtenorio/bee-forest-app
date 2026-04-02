/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

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

// POST/PUT/PATCH/DELETE to API: NetworkOnly (app manages its own sync queue via IDB)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && self.location.origin === url.origin,
  new NetworkOnly(),
  'POST'
);
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && self.location.origin === url.origin,
  new NetworkOnly(),
  'PUT'
);
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/') && self.location.origin === url.origin,
  new NetworkOnly(),
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
