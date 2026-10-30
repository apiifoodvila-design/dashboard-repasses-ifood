// Service worker do app Escala Vila Árabe.
// Página sempre buscada na rede primeiro (para receber atualizações na hora);
// a cópia em cache só é usada sem internet. Dados do Supabase nunca são guardados.
const CACHE = "escala-va-v7";
const BASE = ["./", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Navegação: rede primeiro, cache se estiver offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put("./", c)); return r; })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // Arquivos do próprio app, fontes e bibliotecas de CDN: cache primeiro
  const estatico = url.origin === location.origin ||
    /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net)$/.test(url.hostname);
  if (!estatico) return; // Supabase e demais APIs: sempre direto na rede

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
      return r;
    }))
  );
});
