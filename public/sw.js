/* global self, caches */
const CACHE = "cuebracket-public-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/offline.html")));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("cuebracket-public-") && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
// Never cache account HTML, auth/API responses, scores, or third-party requests.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(async () => (await caches.match("/offline.html")) || Response.error()));
});
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { /* Show a generic update for malformed payloads. */ }
  const titles = { club_event: "New club event", registration_status: "Registration update", membership_status: "Club membership update", match_live: "Your match is live", table_assignment: "Your table is ready", followed_player_live: "A player you follow is live", delivery_test: "Automatic delivery check", test: "CueBracket alerts are working" };
  event.waitUntil(self.registration.showNotification(titles[payload.type] || "CueBracket update", {
    body: payload.type === "test" ? "This device is ready for your opted-in alerts." : "Open CueBracket to view your update.",
    icon: "/pwa-icon/192", badge: "/pwa-icon/192",
    tag: typeof payload.id === "string" ? `cuebracket-${payload.id.slice(0, 100)}` : "cuebracket-update",
    data: { href: "/notifications" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Always enter through the authenticated inbox; payloads cannot open arbitrary URLs.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate("/notifications"); await existing.focus(); }
    else await self.clients.openWindow("/notifications");
  })());
});
