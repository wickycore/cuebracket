"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LeagueFixtures } from "@/components/LeagueFixtures";
import { LeaguePlayerManager } from "@/components/LeaguePlayerManager";
import { LeagueStandings } from "@/components/LeagueStandings";
import { deleteLeague, getLeague, League, subscribeToLeagueChanges } from "@/lib/leagues";

export default function LeagueManagePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [league, setLeague] = useState<League | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = () => {
      const found = getLeague(params.id);
      setMissing(!found);
      setLeague(found ?? null);
    };
    load();
    return subscribeToLeagueChanges(load);
  }, [params.id]);

  if (missing) {
    return <main className="min-h-screen bg-slate-950 p-10 text-white"><h1 className="text-3xl font-black">League not found</h1><Link href="/dashboard" className="mt-5 inline-block text-cyan-300">Return to dashboard</Link></main>;
  }
  if (!league) return null;

  const completed = league.fixtures.filter((fixture) => fixture.completed).length;
  const progress = league.fixtures.length ? Math.round((completed / league.fixtures.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black uppercase text-emerald-300">{league.status}</span>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-300">{league.season}</span>
            </div>
            <h1 className="mt-4 text-4xl font-black">{league.name}</h1>
            <p className="mt-2 text-slate-400">{league.venue || "Venue not set"} · Race to {league.raceTo}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/league/${league.id}`} className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950">Open public view</Link>
            <button onClick={() => { if (window.confirm(`Delete “${league.name}”?`)) { deleteLeague(league.id); router.push("/dashboard"); } }} className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300">Delete</button>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex justify-between text-sm font-bold text-slate-300"><span>League progress</span><span>{progress}%</span></div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-950"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="mt-2 text-sm text-slate-500">{completed} of {league.fixtures.length} fixtures completed</p>
        </div>

        <div className="mt-8 space-y-8">
          <LeaguePlayerManager league={league} onChange={setLeague} />
          <LeagueStandings league={league} />
          <LeagueFixtures league={league} admin onChange={setLeague} />
        </div>
      </div>
    </main>
  );
}
