import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LeagueList } from "@/components/LeagueList";

export default function LeaguesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Leagues</p>
            <h1 className="mt-3 text-4xl font-black">League management.</h1>
            <p className="mt-3 text-slate-400">Create schedules, enter scores and calculate standings automatically.</p>
          </div>
          <Link href="/leagues/new" className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">+ Create League</Link>
        </div>
        <div className="mt-8"><LeagueList /></div>
      </div>
    </main>
  );
}
