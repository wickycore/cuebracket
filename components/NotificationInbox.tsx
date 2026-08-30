"use client";

import Link from "next/link";
import { useState } from "react";

import { deleteNotification, markAllNotificationsRead, markNotificationRead, saveNotificationPreferences } from "@/lib/cloud/notifications";
import { DEFAULT_NOTIFICATION_PREFERENCES, notificationIcon, type NotificationPreferencesRow, type NotificationRow } from "@/lib/notifications";

interface Props {
  initialNotifications: NotificationRow[];
  initialPreferences: NotificationPreferencesRow | null;
}

export function NotificationInbox({ initialNotifications, initialPreferences }: Props) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [preferences, setPreferences] = useState({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(initialPreferences ? {
      club_events: initialPreferences.club_events,
      registration_updates: initialPreferences.registration_updates,
      match_alerts: initialPreferences.match_alerts,
    } : {}),
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const unread = notifications.filter((item) => !item.read_at).length;

  async function markAll() {
    setBusy("all");
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    } finally { setBusy(""); }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await deleteNotification(id);
      setNotifications((items) => items.filter((item) => item.id !== id));
    } finally { setBusy(""); }
  }

  async function openItem(item: NotificationRow) {
    if (item.read_at) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((current) => current.id === item.id ? { ...current, read_at: now } : current));
    await markNotificationRead(item.id);
  }

  async function changePreference(key: keyof typeof preferences, checked: boolean) {
    const next = { ...preferences, [key]: checked };
    setPreferences(next);
    setMessage("");
    setBusy(`preference-${key}`);
    try { await saveNotificationPreferences(next); }
    catch { setPreferences(preferences); setMessage("Your preference could not be saved. Try again when connected."); }
    finally { setBusy(""); }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/65">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div><h2 className="text-xl font-black">Latest updates</h2><p className="mt-1 text-sm text-slate-500">{unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "You are all caught up"}</p></div>
          {unread ? <button type="button" onClick={() => void markAll()} disabled={Boolean(busy)} className="rounded-xl border border-cyan-400/20 px-3 py-2 text-xs font-black text-cyan-300">{busy === "all" ? "Saving…" : "Mark all read"}</button> : null}
        </div>
        {notifications.length ? (
          <div className="divide-y divide-white/10">
            {notifications.map((item) => (
              <div key={item.id} className={`flex gap-3 p-4 sm:gap-4 sm:p-6 ${item.read_at ? "" : "bg-cyan-400/[0.035]"}`}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-slate-950/55 text-xl">{notificationIcon(item.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="font-black text-white">{item.title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{item.message}</p></div>{!item.read_at ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-400" /> : null}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-3"><Link href={item.href} onClick={() => void openItem(item)} className="text-sm font-black text-cyan-300">Open update →</Link><button type="button" onClick={() => void remove(item.id)} disabled={busy === item.id} className="text-xs font-bold text-slate-600 hover:text-rose-300">Remove</button><span className="text-xs text-slate-600">{new Date(item.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="px-6 py-16 text-center"><p className="text-3xl">🔔</p><p className="mt-4 text-lg font-black">Nothing here yet.</p><p className="mt-2 text-sm text-slate-500">Follow a club or register for a tournament to receive useful updates.</p></div>}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-900/65 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Preferences</p>
        <h2 className="mt-2 text-xl font-black">Only useful alerts.</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Choose your inbox updates and opted-in phone alerts. These preferences apply across your devices.</p>
        <div className="mt-5 space-y-3">
          {([
            ["club_events", "Club tournaments", "Registration openings from clubs you follow or belong to."],
            ["registration_updates", "Registration updates", "Approval, waitlist, check-in and membership decisions."],
            ["match_alerts", "Match & table alerts", "A notice when your match starts or a table is assigned."],
          ] as const).map(([key, title, description]) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <input type="checkbox" checked={preferences[key]} disabled={busy.startsWith("preference-")} onChange={(event) => void changePreference(key, event.target.checked)} className="mt-1 h-5 w-5 accent-cyan-400" />
              <span><span className="block text-sm font-black text-white">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
            </label>
          ))}
        </div>
        {message ? <p role="alert" className="mt-4 text-sm text-amber-200">{message}</p> : null}
        <p className="mt-5 text-xs leading-5 text-slate-500">Changing these preferences does not grant phone notification permission. Use the device controls above to opt in or turn phone alerts off.</p>
      </section>
    </div>
  );
}
