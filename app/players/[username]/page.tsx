import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FollowPlayerButton, PlayerFollowingProvider } from "@/components/PlayerFollowing";
import { LiveMatchFeed } from "@/components/LiveMatchFeed";
import { RemoteMedia } from "@/components/RemoteMedia";
import { AppHeader } from "@/components/AppHeader";
import { placementLabel, type PlayerStatisticsRow, type PlayerTournamentHistoryRow } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";

interface PlayerProfilePageProps {
  params: Promise<{ username: string }>;
}

async function getProfile(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, username, tournament_name, bio, avatar_url, created_at, is_public")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  return data;
}

export async function generateMetadata({ params }: PlayerProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) return { title: "Player not found" };

  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio || `${profile.display_name}'s CueBracket player profile.`,
    alternates: { canonical: `/players/${profile.username}` },
  };
}

export default async function PlayerProfilePage({ params }: PlayerProfilePageProps) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) notFound();

  const supabase = await createClient();
  const [{ data: statisticsData }, { data: historyData }, { data: followerCountData }] = await Promise.all([
    supabase.from("player_statistics").select("*").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("player_tournament_history").select("*").eq("profile_id", profile.id).order("played_at", { ascending: false }).limit(20),
    supabase.from("player_follower_counts").select("follower_count").eq("player_id", profile.id).maybeSingle(),
  ]);
  const statistics = statisticsData as PlayerStatisticsRow | null;
  const history = (historyData ?? []) as PlayerTournamentHistoryRow[];

  const initial = profile.display_name.trim().charAt(0).toUpperCase() || "C";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <section className="overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_38%),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] shadow-2xl shadow-black/35">
          <div className="h-1.5 bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400" />
          <div className="p-6 sm:p-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {profile.avatar_url ? (
                <RemoteMedia
                  src={profile.avatar_url}
                  alt={`${profile.tournament_name || profile.display_name} profile picture`}
                  width={192}
                  height={192}
                  sizes="96px"
                  priority
                  className="h-24 w-24 rounded-[1.75rem] border border-white/15 object-cover shadow-xl shadow-black/30"
                />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-[1.75rem] border border-cyan-300/25 bg-cyan-400/10 text-4xl font-black text-cyan-200 shadow-xl shadow-black/30">
                  {initial}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">CueBracket player</p>
                <h1 className="mt-2 break-words text-4xl font-black sm:text-5xl">{profile.display_name}</h1>
                <p className="mt-2 text-base font-black text-slate-400">@{profile.username}</p>
                <p className="mt-3 inline-flex rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-200">{followerCountData?.follower_count ?? 0} follower{followerCountData?.follower_count === 1 ? "" : "s"}</p>
              </div>
            </div>

            {profile.bio ? (
              <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300">{profile.bio}</p>
            ) : null}

            <div className="mt-6 space-y-3"><PlayerFollowingProvider><FollowPlayerButton playerId={profile.id} profile={profile} /></PlayerFollowingProvider><p className="text-xs leading-5 text-slate-400">Follow first, then turn on match alerts. Enable phone delivery in Notifications.</p></div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Tournament name</p>
                <p className="mt-2 text-xl font-black text-white">{profile.tournament_name || profile.display_name}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">CueBracket member since</p>
                <p className="mt-2 text-xl font-black text-white">
                  {new Date(profile.created_at).toLocaleDateString("en", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </section>

        {profile.is_public ? <div className="mt-6"><LiveMatchFeed playerIds={[profile.id]} /></div> : null}

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Verified record</p>
              <h2 className="mt-2 text-2xl font-black">Player statistics</h2>
            </div>
            <a href="/rankings" className="text-sm font-black text-cyan-300">Overall rankings →</a>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Ranking points", statistics?.ranking_points ?? 0],
              ["Matches", statistics?.matches_played ?? 0],
              ["Record", `${statistics?.wins ?? 0}–${statistics?.losses ?? 0}`],
              ["Win rate", `${statistics?.win_percentage ?? 0}%`],
              ["Titles", statistics?.titles ?? 0],
              ["Podiums", statistics?.podiums ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[0.66rem] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Tournament history</p>
          <h2 className="mt-2 text-2xl font-black">Verified events</h2>
          {history.length ? (
            <div className="mt-5 space-y-3">
              {history.map((event) => (
                <a key={event.tournament_id} href={`/cloud/live/${event.tournament_id}`} className="block rounded-2xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-cyan-400/25">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">{event.tournament_name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{event.club_name || event.venue || "Independent event"} · {new Date(event.played_at).toLocaleDateString("en", { dateStyle: "medium" })}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${event.placement === 1 ? "bg-amber-300/15 text-amber-200" : "bg-cyan-300/10 text-cyan-200"}`}>{placementLabel(event.placement)}</span>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-400">{event.matches_played} matches · {event.wins} wins · {event.losses} losses · {event.frames_for}–{event.frames_against} frames</p>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-white/10 px-5 py-7 text-center text-sm leading-6 text-slate-400">No verified results yet. Results appear when this profile registers for and plays in a cloud-synced tournament.</p>
          )}
        </section>
      </div>
    </main>
  );
}
