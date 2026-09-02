import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { PlayerProfileEditor } from "@/components/PlayerProfileEditor";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My player profile", description: "Manage your public player name, photo and CueBracket profile." };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, tournament_name, bio, is_public, avatar_url, platform_role, created_at")
    .eq("id", user!.id)
    .maybeSingle();

  const fallbackName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "CueBracket Player";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
          User account
        </p>
        <h1 className="mt-3 text-4xl font-black">
          {fallbackName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Manage your account and the optional player identity you can use when tournament registration launches.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            ["Email", user?.email],
            ["Role", profile?.platform_role ?? "organizer"],
            ["User ID", user?.id],
            ["Joined", profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-2 break-all font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        <PlayerProfileEditor
          userId={user!.id}
          initialProfile={{
            displayName: fallbackName,
            username: profile?.username ?? "",
            tournamentName: profile?.tournament_name ?? fallbackName,
            bio: profile?.bio ?? "",
            isPublic: profile?.is_public ?? true,
            avatarUrl: profile?.avatar_url ?? null,
          }}
        />
      </div>
    </main>
  );
}
