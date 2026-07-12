"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LeagueFixtures } from "@/components/LeagueFixtures";
import { LeagueStandings } from "@/components/LeagueStandings";
import { getLeague, League, subscribeToLeagueChanges } from "@/lib/leagues";

export default function PublicLeaguePage() {
  const params = useParams<{ id: string }>();
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    const load = () => setLeague(getLeague(params.id) ?? null);
    load();
    return subscribeToLeagueChanges(load);
  }, [params.id]);

  if (!league) {
    return <main className="min-h-screen bg-slate-950 p-10 text-white"><h1 className="text-3xl font-black">League not found</h1></main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-black text-cyan-300">🎱 CueBracket Pro</Link>
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase text-emerald-300">Public league</span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">{league.season}</p>
        <h1 className="mt-3 text-4xl font-black">{league.name}</h1>
        <p className="mt-2 text-slate-400">{league.venue || "Venue not set"} · {league.gameType} · Race to {league.raceTo}</p>
        <div className="mt-8 space-y-8">
          <LeagueStandings league={league} />
          <LeagueFixtures league={league} />
        </div>
      </div>
    </main>
  );
}
