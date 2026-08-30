import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { FollowingDashboard, PlayerFollowingProvider } from "@/components/PlayerFollowing";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Following · CueBracket" };

export default async function FollowingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/following");
  return <main className="min-h-dvh bg-slate-950 text-white"><AppHeader /><div className="cb-shell space-y-7 py-8 sm:py-12">
    <header><p className="cb-kicker">Your courtside seat</p><h1 className="mt-2 text-4xl font-black sm:text-5xl">Players you follow</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Keep your favorite players close. Following is private; match alerts are off until you turn them on for each player. Alerts cover public, cloud-synced matches with linked profiles—not private or offline games.</p><Link href="/notifications" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cyan-300/25 px-4 text-sm font-black text-cyan-300">Set up phone alerts & notification preferences →</Link></header>
    <PlayerFollowingProvider><FollowingDashboard /></PlayerFollowingProvider>
  </div></main>;
}
