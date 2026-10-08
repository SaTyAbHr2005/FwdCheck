// Makes the site installable (needed for Android "Share -> FwdCheck") and makes sharing feel instant:
// the shared item is parked in Cache Storage and /share/checking runs the check with live progress.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "POST" || url.pathname !== "/share") return;
  e.respondWith((async () => {
    const fd = await e.request.formData();
    // What Android handed us, before storage: shown on the error screen if the shared file goes missing.
    const seen = [...fd.entries()].map(([k, v]) => typeof v === "string" ? `${k}: text` : `${k}: ${v.type || "no type"}, ${v.size} bytes`).join(" · ") || "nothing";
    const headers = { "x-share-received": encodeURIComponent(seen) };
    await (await caches.open("share")).put("/share-data", new Response(fd, { headers }));
    return Response.redirect("/share/checking", 303);
  })());
});
