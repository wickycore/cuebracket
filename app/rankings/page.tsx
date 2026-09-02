import type { Metadata } from "next";
import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";
import { RANKING_POINTS_DESCRIPTION, type PlayerRankingRow } from "@/lib/rankings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Player rankings",
  description: "Verified CueBracket match statistics and overall player rankings.",
  alternates: { canonical: "/rankings" },
};

export default async function RankingsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_rankings")
    .select("*")
    .order("global_rank")
    .limit(250);
  const rankings = (data ?? []) as PlayerRankingRow[];

  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
        <section className="overflow-hidden rounded-[2.2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_85%_5%,rgba(34,211,238,0.16),transparent_24rem),linear-gradient(145deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-6 sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Verified performance</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Player rankings</h1>
          <p className="mt-4 max-w-3xl leading-7 text-slate-400">
            Results count only when a registered CueBracket profile plays in an organizer-run tournament. {RANKING_POINTS_DESCRIPTION}
          </p>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 font-bold text-rose-100">Rankings are temporarily unavailable.</p>
        ) : rankings.length ? (
          <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60">
            <div className="hidden grid-cols-[4rem_minmax(12rem,1fr)_7rem_7rem_7rem_7rem] gap-3 border-b border-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-400 md:grid">
              <span>Rank</span><span>Player</span><span className="text-right">Points</span><span className="text-right">W–L</span><span className="text-right">Win %</span><span className="text-right">Titles</span>
            </div>
            <div className="divide-y divide-white/8">
              {rankings.map((player) => (
                <Link key={player.profile_id} href={`/players/${player.username}`} className="grid gap-3 px-4 py-4 transition hover:bg-white/[0.04] md:grid-cols-[4rem_minmax(12rem,1fr)_7rem_7rem_7rem_7rem] md:items-center md:px-5">
                  <div className="flex items-center justify-between md:block">
                    <span className={`grid h-10 w-10 place-items-center rounded-xl font-black ${player.global_rank <= 3 ? "bg-amber-300/15 text-amber-200 ring-1 ring-amber-300/20" : "bg-white/[0.05] text-slate-400"}`}>#{player.global_rank}</span>
                    <span className="text-2xl font-black text-cyan-300 md:hidden">{player.ranking_points} pts</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black">{player.tournament_name || player.display_name}</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-400">@{player.username} · {player.matches_played} verified matches</p>
                  </div>
                  <p className="hidden text-right text-xl font-black text-cyan-300 md:block">{player.ranking_points}</p>
                  <p className="text-sm font-black text-slate-300 md:text-right"><span className="text-slate-400 md:hidden">Record · </span>{player.wins}–{player.losses}</p>
                  <p className="text-sm font-black text-slate-300 md:text-right"><span className="text-slate-400 md:hidden">Win rate · </span>{player.win_percentage}%</p>
                  <p className="text-sm font-black text-slate-300 md:text-right"><span className="text-slate-400 md:hidden">Titles · </span>{player.titles}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] px-6 py-14 text-center">
            <h2 className="text-2xl font-black">The ranking table is ready</h2>
            <p className="mx-auto mt-2 max-w-lg leading-7 text-slate-400">Verified results will appear after registered CueBracket players finish matches in cloud-synced tournaments.</p>
          </section>
        )}
      </div>
    </main>
  );
}
