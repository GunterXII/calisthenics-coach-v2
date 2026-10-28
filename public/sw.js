const CACHE = 'calisthenics-coach-v2-shell-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest']
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(SHELL)
    const response = await fetch('/index.html', { cache: 'reload' })
    const html = await response.text()
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\\.(?:js|css))"/g)]
      .map(match => new URL(match[1], self.location.origin).pathname)
      .filter(path => path.startsWith('/') && !path.startsWith('//'))
    await cache.addAll(assets)
  })())
  self.skipWaiting()
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('calisthenics-coach-v2-') && key !== CACHE).map(key => caches.delete(key)))))
  self.clients.claim()
})
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); void caches.open(CACHE).then(cache => cache.put(event.request, copy)) }
    return response
  }).catch(() => caches.match('/index.html'))))
})
