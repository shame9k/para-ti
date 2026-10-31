// Garde la carte en mémoire pour qu'elle s'ouvre même sans connexion.
// Changer VERSION après une modification pour forcer la mise à jour.
const VERSION = "para-ti-v3";
const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;700&family=Caveat:wght@700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap";
const FILES = [
  "./", "index.html", "manifest.json", "apple-touch-icon.png", "icon-192.png", "icon-512.png",
  ...Array.from({ length: 16 }, (_, i) => `photos/${String(i + 1).padStart(2, "0")}.jpg`),
];

self.addEventListener("install", e => e.waitUntil((async () => {
  const cache = await caches.open(VERSION);
  await cache.addAll(FILES);
  // Polices : la feuille de style puis les fichiers qu'elle référence
  try {
    const css = await fetch(FONTS_CSS);
    await cache.put(FONTS_CSS, css.clone());
    const urls = new Set([...(await css.text()).matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]));
    await cache.addAll([...urls]);
  } catch (_) { /* sans polices, la carte reste lisible */ }
  self.skipWaiting();
})()));

self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // La page : réseau d'abord (pour recevoir les mises à jour), mémoire si hors ligne
  if (e.request.mode === "navigate") {
    // (une page d'erreur, si le site est coupé, ne remplace jamais la carte)
    e.respondWith(fetch(e.request).then(async res => {
      if (!res.ok) return (await caches.match("index.html")) || res;
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put("index.html", copy));
      return res;
    }).catch(() => caches.match("index.html")));
    return;
  }
  // Le reste : mémoire d'abord, réseau sinon (et on garde ce qui arrive)
  e.respondWith(caches.match(e.request, { ignoreVary: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok || res.type === "opaque") {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return res;
  })));
});
