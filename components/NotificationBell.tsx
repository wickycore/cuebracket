"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { markAllNotificationsRead, markNotificationRead } from "@/lib/cloud/notifications";
import { notificationIcon, type NotificationRow } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setUserId(user.id);

      async function refresh() {
        const [{ data }, { count }] = await Promise.all([
          supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .is("read_at", null),
        ]);
        if (active) {
          setNotifications((data ?? []) as NotificationRow[]);
          setUnread(count ?? 0);
        }
      }

      await refresh();
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          () => void refresh(),
        )
        .subscribe();
    }

    void load();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!userId) return null;

  async function markAll() {
    await markAllNotificationsRead();
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    setUnread(0);
  }

  function openNotification(item: NotificationRow) {
    setOpen(false);
    if (!item.read_at) {
      setNotifications((items) => items.map((current) => current.id === item.id ? { ...current, read_at: new Date().toISOString() } : current));
      setUnread((count) => Math.max(0, count - 1));
      void markNotificationRead(item.id);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-lg text-slate-200 hover:border-cyan-400/25 hover:text-white">
        <span aria-hidden="true">🔔</span>
        {unread ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-cyan-400 px-1 text-[0.62rem] font-black text-slate-950 ring-2 ring-slate-950">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-[160] w-[min(90vw,24rem)] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#07111f] shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
            <div><p className="text-sm font-black text-white">Notifications</p><p className="text-xs text-slate-500">{unread ? `${unread} unread` : "You are all caught up"}</p></div>
            {unread ? <button type="button" onClick={() => void markAll()} className="text-xs font-black text-cyan-300">Mark all read</button> : null}
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-2">
            {notifications.length ? notifications.map((item) => (
              <Link key={item.id} href={item.href} onClick={() => openNotification(item)} className={`flex gap-3 rounded-2xl p-3 transition hover:bg-white/[0.055] ${item.read_at ? "opacity-65" : "bg-cyan-400/[0.055]"}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lg">{notificationIcon(item.type)}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-black text-white">{item.title}</span><span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-400">{item.message}</span><span className="mt-1.5 block text-[0.68rem] font-bold text-slate-600">{new Date(item.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span></span>
                {!item.read_at ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-400" /> : null}
              </Link>
            )) : <div className="px-5 py-9 text-center text-sm text-slate-500">Club and tournament updates will appear here.</div>}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-white/10 px-4 py-3.5 text-center text-sm font-black text-cyan-300 hover:bg-white/[0.04]">Open notification inbox →</Link>
        </div>
      ) : null}
    </div>
  );
}
