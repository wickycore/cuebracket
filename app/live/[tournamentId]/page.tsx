"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ReadOnlyBracket } from "@/components/ReadOnlyBracket";
import { getTournamentStats } from "@/components/TournamentStats";
import { getAllMatches, getTournament, subscribeToTournamentChanges, Tournament } from "@/lib/tournaments";

export default function PublicLivePage() {
  const params = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const load = () => {
      setTournament(getTournament(params.tournamentId) ?? null);
      setChecked(true);
    };
    load();
    const unsubscribe = subscribeToTournamentChanges(load);
    const timer = window.setInterval(load, 2000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, [params.tournamentId]);

  const matches = useMemo(() => tournament ? getAllMatches(tournament).filter((match) => match.player1 && match.player2) : [], [tournament]);
  const current = matches.filter((match) => match.status === "live" && !match.completed);
  const stats = tournament ? getTournamentStats(tournament) : null;

  if (!checked) return <main className="min-h-screen bg-slate-950" />;
  if (!tournament) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
        <div><p className="text-5xl">🎱</p><h1 className="mt-5 text-3xl font-black">Tournament unavailable</h1><p className="mt-2 text-slate-400">This local-storage phase can only display tournaments saved in this browser.</p><Link href="/" className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">CueBracket home</Link></div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="font-black">🎱 CueBracket <span className="text-cyan-400">Live</span></Link>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/20">Auto refresh</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-400">Public spectator view</p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">{tournament.name}</h1>
          <p className="mt-3 text-slate-400">{tournament.venue || "Venue not set"} · Race to {tournament.raceTo}</p>
        </div>

        {tournament.bracket?.champion ? <section className="mt-8 rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-8 text-center"><p className="text-5xl">🏆</p><p className="mt-3 text-sm font-black uppercase tracking-[0.25em] text-amber-300">Champion</p><h2 className="mt-2 text-4xl font-black">{tournament.bracket.champion}</h2></section> : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats ? [["Progress", `${stats.progress}%`], ["Current round", stats.currentRound], ["Completed", stats.completedMatches], ["Remaining", stats.remainingMatches]].map(([label, value]) => <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>) : null}
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-black">Current matches</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {current.length ? current.map((match) => <article key={match.id} className="rounded-[2rem] border border-emerald-400/25 bg-emerald-400/[0.07] p-6"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-emerald-300">● Live</span><span className="text-sm text-slate-400">{match.tableNumber || "Table TBA"}</span></div><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center"><div><p className="truncate font-black">{match.player1}</p><p className="mt-2 text-5xl font-black text-cyan-300">{match.score1 ?? 0}</p></div><span className="text-slate-600">VS</span><div><p className="truncate font-black">{match.player2}</p><p className="mt-2 text-5xl font-black text-cyan-300">{match.score2 ?? 0}</p></div></div>{match.breakPlayer ? <p className="mt-4 text-center text-sm text-amber-300">Break: {match.breakPlayer === 1 ? match.player1 : match.player2}</p> : null}</article>) : <div className="rounded-3xl border border-dashed border-white/15 p-8 text-slate-400">No match is marked live right now.</div>}
          </div>
        </section>

        <section className="mt-10"><h2 className="mb-4 text-2xl font-black">Live bracket</h2><ReadOnlyBracket tournament={tournament} /></section>

      </div>
    </main>
  );
}
