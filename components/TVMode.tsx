"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllMatches, getTournament, getTournamentChampion, subscribeToTournamentChanges, Tournament } from "@/lib/tournaments";

export function TVMode({ tournamentId }: { tournamentId: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const load = () => setTournament(getTournament(tournamentId) ?? null);
    load();
    const unsub = subscribeToTournamentChanges(load);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, [tournamentId]);

  const data = useMemo(() => {
    if (!tournament) return null;
    const matches = getAllMatches(tournament);
    const live = matches.find((match) => match.status === "live" && !match.completed);
    const upcoming = matches
      .filter((match) => match.player1 && match.player2 && !match.completed && match.id !== live?.id)
      .slice(0, 4);
    const completed = matches.filter((match) => match.completed).length;
    const playable = matches.filter((match) => match.player1 && match.player2).length;
    const progress = playable ? Math.round((completed / playable) * 100) : 0;
    return { live, upcoming, completed, playable, progress };
  }, [tournament]);

  if (!tournament || !data) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-white">Tournament not found</main>;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#123047_0%,_#07111e_42%,_#020617_100%)] p-8 text-white">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.35em] text-cyan-300">CueBracket Live Display</p>
            <h1 className="mt-2 text-5xl font-black">{tournament.name}</h1>
            <p className="mt-2 text-xl text-slate-400">{tournament.venue || "Venue not set"}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black tabular-nums">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="mt-1 text-sm text-slate-500">{now.toLocaleDateString()}</p>
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[2.5rem] border border-cyan-400/20 bg-cyan-400/[0.06] p-8 shadow-2xl shadow-cyan-950/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">Now playing</p>
              <span className="animate-pulse rounded-full bg-rose-400/15 px-4 py-2 text-sm font-black text-rose-300">● LIVE</span>
            </div>

            {data.live ? (
              <div className="mt-10">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                  <div className="text-right">
                    <p className="text-4xl font-black">{data.live.player1}</p>
                    <p className="mt-3 text-8xl font-black text-cyan-300">{data.live.score1 ?? 0}</p>
                  </div>
                  <div className="text-3xl font-black text-slate-600">VS</div>
                  <div>
                    <p className="text-4xl font-black">{data.live.player2}</p>
                    <p className="mt-3 text-8xl font-black text-cyan-300">{data.live.score2 ?? 0}</p>
                  </div>
                </div>
                <div className="mt-8 flex justify-center gap-3 text-lg font-bold text-slate-400">
                  <span className="rounded-full bg-black/20 px-5 py-2">{data.live.tableNumber || "Table not assigned"}</span>
                  <span className="rounded-full bg-black/20 px-5 py-2">Race to {tournament.raceTo}</span>
                </div>
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center text-center">
                <div>
                  <p className="text-6xl">🎱</p>
                  <h2 className="mt-4 text-4xl font-black">Waiting for the next match</h2>
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-[2.5rem] border border-white/10 bg-white/[0.04] p-7">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">Up next</p>
            <div className="mt-5 space-y-3">
              {data.upcoming.length ? data.upcoming.map((match, index) => (
                <div key={match.id} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-600">Match {index + 1}</p>
                  <div className="mt-2 flex items-center justify-between gap-4 font-black">
                    <span>{match.player1}</span><span className="text-slate-600">vs</span><span>{match.player2}</span>
                  </div>
                </div>
              )) : <p className="text-slate-500">No upcoming matches.</p>}
            </div>
          </aside>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between font-bold">
            <span>Tournament progress</span><span>{data.progress}%</span>
          </div>
          <div className="mt-3 h-4 overflow-hidden rounded-full bg-slate-950">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-700" style={{ width: `${data.progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-slate-500">{data.completed} of {data.playable} playable matches complete</p>
        </section>

        {getTournamentChampion(tournament) ? (
          <div className="mt-8 rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-7 text-center">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-300">Tournament champion</p>
            <p className="mt-3 text-6xl font-black">🏆 {getTournamentChampion(tournament)}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
