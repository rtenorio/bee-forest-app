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

// ── Web Push ──────────────────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  let data: { title?: string; body?: string; url?: string } = {};
  try { data = event.data.json(); } catch { data = { title: 'Bee Forest', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Bee Forest', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url ?? '/' },
      tag: data.url ?? 'default',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(url);
      } else {
        self.clients.openWindow(url);
      }
    })
  );
});
