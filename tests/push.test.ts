import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import manifest from "../app/manifest.ts";
import { applicationServerKey } from "@/lib/push";
import { validSubscription, pushAllowed, permanentPushFailure } from "../supabase/functions/push-notifications/policy.ts";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();
const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/example", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } };

test("push endpoints allow real providers but reject SSRF and invalid subscription keys", () => {
  assert.equal(validSubscription(sub), true);
  for (const endpoint of ["https://web.push.apple.com/Q123", "https://updates.push.services.mozilla.com/wpush/v2/example", "https://wns2.notify.windows.com/w/?token=x"]) assert.equal(validSubscription({ ...sub, endpoint }), true);
  for (const endpoint of ["http://fcm.googleapis.com/fcm/send/example", "https://127.0.0.1/private", "https://fcm.googleapis.com.attacker.test/", "https://fcm.googleapis.com:444/send", "https://user:pass@fcm.googleapis.com/send", "https://evil.test/x", "https://fcm.googleapis.com/"]) assert.equal(validSubscription({ ...sub, endpoint }), false, endpoint);
  assert.equal(validSubscription({ ...sub, keys: { ...sub.keys, auth: "bad" } }), false);
  assert.equal(validSubscription({ ...sub, keys: { ...sub.keys, p256dh: randomBytes(65).fill(0).toString("base64url") } }), false);
  assert.equal(validSubscription(null), false);
  assert.deepEqual(applicationServerKey(sub.keys.p256dh), Uint8Array.from(ecdh.getPublicKey()));
  assert.throws(() => applicationServerKey("invalid"));
});

test("delivery honors every preference and removes only expired endpoints", () => {
  const off = { club_events: false, registration_updates: false, match_alerts: false };
  for (const type of ["club_event", "registration_status", "membership_status", "match_live", "table_assignment"]) {
    assert.equal(pushAllowed(type, off), false);
    assert.equal(pushAllowed(type, null), true);
  }
  assert.equal(pushAllowed("unknown", null), false);
  for (const status of [404, 410]) assert.equal(permanentPushFailure(status), true);
  for (const status of [0, 401, 403, 429, 500]) assert.equal(permanentPushFailure(status), false);
});

test("install manifest includes standalone mode and standard and maskable icons", () => {
  const value = manifest();
  assert.equal(value.start_url, "/dashboard");
  assert.equal(value.scope, "/");
  assert.equal(value.display, "standalone");
  for (const size of [192, 512]) for (const purpose of ["any", "maskable"]) assert.ok(value.icons?.some((icon) => icon.sizes === `${size}x${size}` && icon.purpose === purpose));
});

function serviceWorker() {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {};
  const shown: Array<{ title: string; options: { body: string; data: { href: string } } }> = [];
  const added: string[] = [];
  const self = {
    addEventListener: (name: string, fn: typeof handlers[string]) => { handlers[name] = fn; },
    location: { origin: "https://cuebracket.test" },
    registration: { showNotification: async (title: string, options: typeof shown[number]["options"]) => { shown.push({ title, options }); } },
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async (url: string) => url },
  };
  vm.runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self, URL, Response, fetch: async () => { throw new Error("offline"); },
    caches: { open: async () => ({ add: async (url: string) => { added.push(url); } }), match: async () => new Response("offline-safe-screen"), keys: async () => [], delete: async () => true },
  });
  return { handlers, shown, added };
}

test("service worker caches only a public offline screen and leaves APIs untouched", async () => {
  const { handlers, added } = serviceWorker();
  let work: Promise<unknown> = Promise.resolve();
  handlers.install({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
  await work;
  assert.deepEqual(added, ["/offline.html"]);
  let intercepted = false;
  handlers.fetch({ request: { method: "GET", mode: "cors", url: "https://cuebracket.test/api/private" }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
  let page: Promise<Response> = Promise.resolve(new Response());
  handlers.fetch({ request: { method: "GET", mode: "navigate", url: "https://cuebracket.test/dashboard" }, respondWith: (promise: Promise<Response>) => { page = promise; } });
  assert.equal(await (await page).text(), "offline-safe-screen");
});

test("push previews cannot leak supplied private data or navigate off-site", async () => {
  const { handlers, shown } = serviceWorker();
  let work: Promise<unknown> = Promise.resolve();
  handlers.push({ data: { json: () => ({ id: "n1", type: "table_assignment", title: "Private player", body: "Secret event", href: "https://evil.test" }) }, waitUntil: (promise: Promise<unknown>) => { work = promise; } });
  await work;
  assert.equal(shown[0].title, "Your table is ready");
  assert.equal(shown[0].options.data.href, "/notifications");
  assert.doesNotMatch(JSON.stringify(shown), /Private player|Secret event|evil\.test/);
});

test("push server routes verify identity and use secret-backed dispatch authentication", () => {
  const edge = readFileSync(new URL("../supabase/functions/push-notifications/index.ts", import.meta.url), "utf8");
  assert.match(edge, /auth\.getUser\(bearer\.slice\(7\)\)/);
  assert.match(edge, /timingSafeEqual\(a, b\)/);
  assert.match(edge, /account_id: user\.id/);
  assert.match(edge, /notification\.user_id !== subscription\.user_id/);
  assert.match(edge, /notification\.read_at/);
  const settings = readFileSync(new URL("../components/PushNotificationSettings.tsx", import.meta.url), "utf8");
  assert.match(settings, /async function enable\(\)[\s\S]*Notification\.requestPermission\(\)/);
  assert.match(settings, /owner !== userId/);
  const schema = readFileSync(new URL("../supabase/migrations/20260830223840_add_opt_in_web_push_and_table_alerts.sql", import.meta.url), "utf8");
  assert.match(schema, /vault\.create_secret/);
  assert.match(schema, /for update skip locked/);
  assert.match(schema, /user_id=\(select auth\.uid\(\)\)/);
  assert.match(schema, /revoke all on function public\.get_push_server_config\(\),public\.initialize_push_keys\(text,text\) from public,anon,authenticated/);
  assert.doesNotMatch(schema, /grant (insert|update|all) on public\.push_subscriptions to authenticated/);
});
