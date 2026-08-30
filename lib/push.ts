export const PUSH_OWNER_KEY = "cuebracket:push-owner:v1";
export function applicationServerKey(value: string) {
  if (!/^[A-Za-z0-9_-]{87}$/.test(value)) throw new Error("Phone alerts are not configured correctly.");
  const bytes = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error("Invalid notification key.");
  return bytes;
}

export async function pushRegistration() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) throw new Error("Phone alerts need a supported browser over HTTPS.");
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Notification setup took too long. Reload and try again.")), 12000); }),
    ]);
  } finally { clearTimeout(timeout); }
}

export async function clearBrowserPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription && !(await subscription.unsubscribe())) throw new Error("Could not turn off alerts on this device.");
  const notifications = await registration?.getNotifications();
  notifications?.forEach((notification) => notification.close());
  window.localStorage.removeItem(PUSH_OWNER_KEY);
}
