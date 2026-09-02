"use client";
import { useEffect, useState } from "react";
import { usePwa } from "@/components/PwaProvider";
import { pushAction } from "@/lib/cloud/push";
import { applicationServerKey, clearBrowserPush, pushRegistration, PUSH_OWNER_KEY } from "@/lib/push";
import { createClient } from "@/lib/supabase/client";

export function PushNotificationSettings({ userId }: { userId: string }) {
  const { ready, ios, installed } = usePwa();
  const [supported, setSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const available = window.isSecureContext && "Notification" in window && "PushManager" in window && "serviceWorker" in navigator;
      setSupported(available);
      if (available) setPermission(Notification.permission);
      if (!available) { setBusy(false); return; }
      void (async () => {
        try {
          const registration = await pushRegistration();
          const sub = await registration.pushManager.getSubscription();
          const owner = localStorage.getItem(PUSH_OWNER_KEY);
          if (sub && owner !== userId) await clearBrowserPush();
          else if (sub) {
            const supabase = createClient();
            const { data, error } = await supabase.from("push_subscriptions").select("id").eq("user_id", userId).eq("endpoint", sub.endpoint).maybeSingle();
            if (error) throw new Error("Could not check phone alerts. Try again when connected.");
            if (data && active) setSubscription(sub);
            else if (!data) await clearBrowserPush();
          }
        } catch (error) { if (active) { setFailed(true); setMessage(error instanceof Error ? error.message : "Could not check phone alerts."); } }
        finally { if (active) setBusy(false); }
      })();
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [userId]);

  async function enable() {
    setBusy(true); setFailed(false); setMessage("");
    let sub: PushSubscription | null = null;
    try {
      // Permission is requested only in direct response to this button.
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") { setMessage(granted === "denied" ? "Notifications are blocked. Allow them in your browser’s site settings if you change your mind." : "No problem—phone alerts remain off."); return; }
      const { publicKey } = await pushAction<{ publicKey: string }>("config");
      const registration = await pushRegistration();
      sub = await registration.pushManager.getSubscription();
      if (sub && localStorage.getItem(PUSH_OWNER_KEY) !== userId) { await clearBrowserPush(); sub = null; }
      sub ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      await pushAction("subscribe", { subscription: sub.toJSON() });
      const { data: { user } } = await createClient().auth.getUser();
      if (user?.id !== userId) throw new Error("Your account changed. Enable alerts after signing in again.");
      localStorage.setItem(PUSH_OWNER_KEY, userId);
      setSubscription(sub); setMessage("Phone alerts are on for this device. Your preferences below apply to them too.");
    } catch (error) {
      if (sub) { await sub.unsubscribe().catch(() => false); }
      setSubscription(null); setFailed(true); setMessage(error instanceof Error ? error.message : "Phone alerts could not be enabled.");
    } finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setFailed(false); setMessage("");
    try {
      const endpoint = subscription?.endpoint;
      // Revoke at the browser first, even when the server cannot be reached.
      await clearBrowserPush(); setSubscription(null);
      if (endpoint) await pushAction("unsubscribe", { endpoint });
      setMessage("Phone alerts are off on this device. Your inbox is unchanged.");
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Could not update phone alerts."); }
    finally { setBusy(false); }
  }
  async function testPush() {
    setBusy(true); setFailed(false); setMessage("");
    try { await pushAction("test", { endpoint: subscription?.endpoint }); setMessage("Test accepted by your push provider. Check your phone’s notifications."); }
    catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Test failed."); }
    finally { setBusy(false); }
  }
  return <section id="phone-alerts" style={{ scrollMarginTop: "6rem" }} className="mt-6 rounded-3xl border border-cyan-300/20 bg-slate-900/65 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="cb-kicker">Opt-in · This device</p><h2 className="mt-2 text-2xl font-black">Phone notifications</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Get club messages, event reminders, registration and match/table updates even when CueBracket is closed. Private details stay inside your signed-in inbox.</p></div><span className={`rounded-full px-3 py-2 text-xs font-black ${subscription ? "bg-emerald-300/10 text-emerald-200" : "bg-white/5 text-slate-400"}`}>{busy ? "Checking…" : subscription ? "On for this device" : "Off"}</span></div>
    {ready && ios && !installed ? <p className="mt-4 text-sm leading-6 text-amber-200">First add CueBracket to your home screen, then open that app to enable alerts. iPhone/iPad requires iOS/iPadOS 16.4 or newer.</p> : ready && !busy && !supported ? <p className="mt-4 text-sm text-slate-300">Phone push is not supported in this browser. Your CueBracket inbox remains available.</p> : <div className="mt-5 flex flex-wrap gap-3">{subscription ? <><button type="button" disabled={busy} onClick={() => void testPush()} className="min-h-12 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 disabled:opacity-50">Send test alert</button><button type="button" disabled={busy} onClick={() => void disable()} className="min-h-12 rounded-xl border border-white/15 px-4 text-sm font-bold text-slate-300 disabled:opacity-50">Turn off on this device</button></> : <button type="button" disabled={busy || !ready || !supported || permission === "denied"} onClick={() => void enable()} className="min-h-12 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 disabled:opacity-50">Enable phone alerts</button>}</div>}
    {permission === "denied" ? <p className="mt-3 text-sm text-amber-200">Notifications are blocked by your browser. You can change this in its site settings.</p> : null}
    {message ? <p role={failed ? "alert" : "status"} className={`mt-4 text-sm leading-6 ${failed ? "text-amber-200" : "text-emerald-200"}`}>{message}</p> : null}
    <p className="mt-4 text-xs leading-5 text-slate-400">Signing out turns off phone alerts on this device. Each device needs its own permission; delivery depends on your connection and phone settings.</p>
  </section>;
}
