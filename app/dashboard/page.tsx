import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { TournamentList } from "@/components/TournamentList";
import { LeagueList } from "@/components/LeagueList";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">Organizer dashboard</p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">Manage tournaments and leagues.</h1>
            <p className="mt-3 max-w-2xl text-slate-400">Create knockout brackets or run a full round-robin season with fixtures and automatic standings.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tournaments/new" className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">+ Create Tournament</Link>
            <Link href="/leagues/new" className="rounded-xl border border-cyan-400/40 px-5 py-3 font-black text-cyan-300 hover:bg-cyan-400/10">+ Create League</Link>
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between">
            <div><h2 className="text-2xl font-black">Your tournaments</h2><p className="mt-1 text-sm text-slate-500">Draft, live and completed events.</p></div>
            <Link href="/tournaments" className="text-sm font-bold text-cyan-300">View all →</Link>
          </div>
          <TournamentList />
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div><h2 className="text-2xl font-black">Your leagues</h2><p className="mt-1 text-sm text-slate-500">Fixtures, results and standings.</p></div>
            <Link href="/leagues" className="text-sm font-bold text-cyan-300">View all →</Link>
          </div>
          <LeagueList compact />
        </section>
      </div>
    </main>
  );
}
