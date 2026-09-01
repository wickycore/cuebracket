export interface DeviceSubscription { endpoint: string; keys: { p256dh: string; auth: string } }

export function validSubscription(value: unknown): value is DeviceSubscription {
  if (!value || typeof value !== "object") return false;
  const sub = value as Partial<DeviceSubscription>;
  if (typeof sub.endpoint !== "string" || sub.endpoint.length > 2048 || !sub.keys) return false;
  try {
    const url = new URL(sub.endpoint);
    const allowed = url.hostname === "fcm.googleapis.com" || url.hostname === "web.push.apple.com" || url.hostname === "updates.push.services.mozilla.com" || url.hostname.endsWith(".notify.windows.com");
    if (!allowed || url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443") || url.pathname.length < 2) return false;
    const decode = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    if (typeof sub.keys.p256dh !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(sub.keys.p256dh) || typeof sub.keys.auth !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(sub.keys.auth)) return false;
    const key = decode(sub.keys.p256dh);
    return key.length === 65 && key[0] === 4 && decode(sub.keys.auth).length === 16;
  } catch { return false; }
}

export function pushAllowed(type: string, preferences: { club_events?: boolean; registration_updates?: boolean; match_alerts?: boolean; followed_player_alerts?: boolean; club_messages?: boolean } | null) {
  if (type === "club_event") return preferences?.club_events !== false;
  if (type === "registration_status" || type === "membership_status") return preferences?.registration_updates !== false;
  if (type === "match_live" || type === "table_assignment") return preferences?.match_alerts !== false;
  if (type === "followed_player_live") return preferences?.followed_player_alerts !== false;
  if (type === "club_message" || type === "club_reminder") return preferences?.club_messages !== false;
  if (type === "delivery_test") return true;
  return false;
}

export function permanentPushFailure(status: number) { return status === 404 || status === 410; }
