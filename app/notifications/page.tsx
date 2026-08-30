import { AppHeader } from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { PwaInstallCard } from "@/components/PwaInstallCard";
import { PushNotificationSettings } from "@/components/PushNotificationSettings";
import { NotificationInbox } from "@/components/NotificationInbox";
import type { NotificationPreferencesRow, NotificationRow } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/notifications");
  const [{ data: notifications }, { data: preferences }] = await Promise.all([
    supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("notification_preferences").select("*").eq("user_id", user!.id).maybeSingle(),
  ]);

  return (
    <main className="min-h-dvh bg-[#020617] text-white">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">CueBracket inbox</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Never miss your next match.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">Club announcements, registration decisions and live match alerts—without noisy group chats.</p>
        <div className="mt-6"><PwaInstallCard /></div>
        <PushNotificationSettings key={user.id} userId={user.id} />
        <NotificationInbox initialNotifications={(notifications ?? []) as NotificationRow[]} initialPreferences={preferences as NotificationPreferencesRow | null} />
      </div>
    </main>
  );
}
