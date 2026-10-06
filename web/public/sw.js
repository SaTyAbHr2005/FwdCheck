// Makes the site installable (needed for Android "Share -> FwdCheck") and makes sharing feel instant:
// the shared item is parked in Cache Storage and /share/checking runs the check with live progress.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "POST" || url.pathname !== "/share") return;
  e.respondWith((async () => {
    const fd = await e.request.formData();
    await (await caches.open("share")).put("/share-data", new Response(fd));
    return Response.redirect("/share/checking", 303);
  })());
});
