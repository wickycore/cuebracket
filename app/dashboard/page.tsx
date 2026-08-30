import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DashboardCommandCenter } from "@/components/DashboardCommandCenter";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/dashboard");
  const { data: profile } = await supabase.from("profiles")
    .select("display_name,tournament_name").eq("id", user.id).maybeSingle();
  // Profile and metadata are display-only; they never determine permissions.
  const candidateName = profile?.tournament_name || profile?.display_name || user.user_metadata?.display_name;
  const displayName = typeof candidateName === "string" && candidateName.trim() ? candidateName.trim() : "there";
  return (
    <main className="cb-app-bg min-h-dvh text-white">
      <AppHeader />
      <DashboardCommandCenter key={user.id} userId={user.id} displayName={displayName} initialNow={new Date().toISOString()} />
    </main>
  );
}
