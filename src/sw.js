import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

// ── App shell / precache (same behavior as the previous generateSW setup) ──
self.skipWaiting()
clientsClaim()
const manifest = self.__WB_MANIFEST
cleanupOutdatedCaches()
precacheAndRoute(manifest)

// SPA navigation fallback (production only: in dev the manifest has no index.html)
if (manifest.some((entry) => (typeof entry === 'string' ? entry : entry.url) === 'index.html')) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
}

const fontCache = (cacheName) =>
  new CacheFirst({
    cacheName,
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })

registerRoute(({ url }) => url.origin === 'https://fonts.googleapis.com', fontCache('google-fonts-cache'))
registerRoute(({ url }) => url.origin === 'https://fonts.gstatic.com', fontCache('gstatic-fonts-cache'))

// ── Push notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data?.text() }
  }

  const title = data.title || 'LUPAY'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/logo-lupay-green.png',
      badge: '/logo-lupay-green.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/gastos' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/gastos', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const appClient = clients.find((c) => new URL(c.url).origin === self.location.origin)
      if (appClient) {
        return appClient.focus().then((c) => c.navigate(target))
      }
      return self.clients.openWindow(target)
    }),
  )
})
