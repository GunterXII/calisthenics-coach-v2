const CACHE = 'calisthenics-coach-v2-shell-v6'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/build-manifest.json', '/icons/coach-192.svg', '/icons/coach-192.png', '/icons/coach-512.svg']

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(SHELL)

    // Vite's build manifest lists entry chunks, shared dependencies, lazy imports,
    // stylesheets and other emitted assets. Cache all of them so "Progressi" also
    // opens without a network connection after the first online launch.
    const response = await fetch('/build-manifest.json', { cache: 'reload' })
    if (!response.ok) throw new Error('Unable to load the production asset manifest')
    const manifest = await response.json()
    const assetPaths = Object.values(manifest).flatMap(entry => {
      if (!entry || typeof entry !== 'object') return []
      const row = entry
      return [row.file, ...(row.css ?? []), ...(row.assets ?? [])].filter(value => typeof value === 'string')
    })
    const assets = [...new Set(assetPaths.map(file => new URL(file, self.location.origin + '/').pathname))]
      .filter(path => path.startsWith('/') && !path.startsWith('//'))
    await cache.addAll(assets)
  })())
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('calisthenics-coach-v2-') && key !== CACHE).map(key => caches.delete(key)),
  )))
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone()
      void caches.open(CACHE).then(cache => cache.put(event.request, copy))
    }
    return response
  }).catch(() => caches.match('/index.html'))))
})
