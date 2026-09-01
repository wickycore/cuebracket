import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";
import { validSubscription, pushAllowed, permanentPushFailure } from "./policy.ts";

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
async function checked<T>(operation: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await operation;
  if (error) throw new Error("Push storage unavailable");
  return data;
}
async function config(initialize: boolean) {
  let value = await checked(db.rpc("get_push_server_config"));
  if (initialize && !value.public_key) {
    const keys = webpush.generateVAPIDKeys();
    value = await checked(db.rpc("initialize_push_keys", { public_key: keys.publicKey, private_key: keys.privateKey }));
  }
  return value as { public_key: string | null; private_key: string | null; hook_token: string };
}
function setKeys(keys: Awaited<ReturnType<typeof config>>) {
  if (!keys.public_key || !keys.private_key) throw new Error("Push is not initialized");
  webpush.setVapidDetails("https://cuebracket-doaa.vercel.app", keys.public_key, keys.private_key);
}

async function dispatch() {
  const jobs = await checked(db.rpc("claim_push_jobs"));
  for (const job of jobs ?? []) {
    try {
      const [notification, subscription] = await Promise.all([
        checked(db.from("notifications").select("id,user_id,type,read_at,created_at").eq("id", job.notification_id).maybeSingle()),
        checked(db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").eq("id", job.subscription_id).maybeSingle()),
      ]);
      const preferences = notification ? await checked(db.from("notification_preferences").select("club_events,registration_updates,match_alerts,followed_player_alerts,club_messages").eq("user_id", notification.user_id).maybeSingle()) : null;
      if (!notification || !subscription || notification.user_id !== subscription.user_id || notification.read_at || Date.parse(notification.created_at) !== Date.parse(job.notification_version) || !pushAllowed(notification.type, preferences) || Date.parse(job.expires_at) <= Date.now()) {
        await checked(db.from("push_delivery_jobs").update({ status: "skipped" }).eq("id", job.id));
        continue;
      }
      if (notification.type === "followed_player_live" && !await checked(db.rpc("can_deliver_player_notification", { notification_id: notification.id }))) {
        await checked(db.from("push_delivery_jobs").update({ status: "skipped" }).eq("id", job.id));
        continue;
      }
      const sub = { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } };
      if (!validSubscription(sub)) {
        await checked(db.from("push_subscriptions").delete().eq("id", subscription.id));
        continue;
      }
      try {
        // Keep player names and event details off lock screens. The signed-in inbox has the details.
        await webpush.sendNotification(sub, JSON.stringify({ id: notification.id, type: notification.type }), { TTL: Math.min(3600, Math.max(0, Math.floor((Date.parse(job.expires_at) - Date.now()) / 1000))), timeout: 8000 });
        await checked(db.from("push_delivery_jobs").update({ status: "sent" }).eq("id", job.id));
      } catch (error) {
        const status = Number((error as { statusCode?: number }).statusCode ?? 0);
        if (permanentPushFailure(status)) await checked(db.from("push_subscriptions").delete().eq("id", subscription.id));
        else if (job.attempts >= 3 || (status >= 400 && status < 500 && status !== 429)) await checked(db.from("push_delivery_jobs").update({ status: "failed" }).eq("id", job.id));
      }
    } catch { /* Lease expiry retries transient storage errors. Never log endpoints, credentials or message bodies. */ }
  }
  return response({ processed: jobs?.length ?? 0 });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const text = await request.text();
    if (text.length > 8192) return response({ error: "Request too large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return response({ error: "Invalid request" }, 400); }
    if (!body || typeof body !== "object") return response({ error: "Invalid request" }, 400);
    if (body.action === "dispatch") {
      // This route uses a Vault-backed webhook secret, not user JWT authorization.
      const token = request.headers.get("x-cuebracket-push-token") || "";
      if (token.length !== 64) return response({ error: "Unauthorized" }, 401);
      const keys = await config(false);
      const a = new TextEncoder().encode(token), b = new TextEncoder().encode(keys.hook_token);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return response({ error: "Unauthorized" }, 401);
      if (!keys.public_key) return response({ processed: 0 });
      setKeys(keys);
      EdgeRuntime.waitUntil(dispatch());
      return response({ queued: true }, 202);
    }
    const bearer = request.headers.get("Authorization") || "";
    if (!bearer.startsWith("Bearer ")) return response({ error: "Sign in to manage phone alerts" }, 401);
    const { data: { user }, error } = await db.auth.getUser(bearer.slice(7));
    if (error || !user) return response({ error: "Sign in to manage phone alerts" }, 401);
    if (body.action === "config") {
      const keys = await config(true);
      return response({ publicKey: keys.public_key });
    }
    if (body.action === "subscribe") {
      if (!validSubscription(body.subscription)) return response({ error: "Unsupported push subscription" }, 400);
      const sub = body.subscription;
      // Endpoint ownership is immutable. Another account must obtain a new browser subscription.
      const existing = await checked(db.from("push_subscriptions").select("id,user_id").eq("endpoint", sub.endpoint).maybeSingle());
      if (existing && existing.user_id !== user.id) return response({ error: "Turn off phone alerts on this device, then enable them again." }, 409);
      const id = await checked(db.rpc("save_push_subscription", { account_id: user.id, push_endpoint: sub.endpoint, public_key: sub.keys.p256dh, auth_key: sub.keys.auth }));
      return response({ id });
    }
    if (body.action === "unsubscribe") {
      if (typeof body.endpoint !== "string" || body.endpoint.length > 2048) return response({ error: "Invalid subscription" }, 400);
      await checked(db.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", body.endpoint));
      return response({ disabled: true });
    }
    if (body.action === "test") {
      // Atomic cooldown prevents repeated requests from spamming a device.
      const sub = await checked(db.rpc("claim_push_test", { account_id: user.id, push_endpoint: String(body.endpoint ?? "") }));
      if (!sub) return response({ error: "Enable alerts first, or wait one minute before testing again." }, 429);
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      if (!validSubscription(subscription)) return response({ error: "Unsupported subscription" }, 400);
      setKeys(await config(false));
      try { await webpush.sendNotification(subscription, JSON.stringify({ type: "test", id: `test-${crypto.randomUUID()}` }), { TTL: 60, timeout: 8000 }); }
      catch (error) {
        if (permanentPushFailure(Number((error as { statusCode?: number }).statusCode))) await checked(db.from("push_subscriptions").delete().eq("id", sub.id));
        return response({ error: "Test delivery failed. Turn off alerts and enable them again." }, 502);
      }
      return response({ sent: true });
    }
    return response({ error: "Unknown action" }, 400);
  } catch { return response({ error: "Phone alerts are temporarily unavailable. Your inbox is still available." }, 503); }
});
