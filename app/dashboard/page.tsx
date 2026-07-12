import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LeagueList } from "@/components/LeagueList";
import { OrganizerOverview } from "@/components/OrganizerOverview";
import { TableManager } from "@/components/TableManager";
import { TournamentList } from "@/components/TournamentList";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f2a3c_0%,_#07111e_36%,_#020617_100%)] text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.045] p-7 sm:p-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-cyan-300">Organizer command center</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">Run the whole pool night from one screen.</h1>
              <p className="mt-4 max-w-2xl text-lg text-slate-400">Tournaments, leagues, live displays, venue tables and champions—organized beautifully.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/tournaments/new" className="rounded-2xl bg-cyan-400 px-5 py-3 font-black text-slate-950">+ Create Tournament</Link>
              <Link href="/leagues/new" className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 px-5 py-3 font-black text-cyan-300">+ Create League</Link>
            </div>
          </div>
        </section>

        <div className="mt-7"><OrganizerOverview /></div>

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between">
            <div><h2 className="text-2xl font-black">Your tournaments</h2><p className="mt-1 text-sm text-slate-500">Draft, live and completed events.</p></div>
            <Link href="/tournaments" className="text-sm font-bold text-cyan-300">View all →</Link>
          </div>
          <TournamentList />
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div><h2 className="text-2xl font-black">Your leagues</h2><p className="mt-1 text-sm text-slate-500">Fixtures, scores and standings.</p></div>
            <Link href="/leagues" className="text-sm font-bold text-cyan-300">View all →</Link>
          </div>
          <LeagueList compact />
        </section>

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between">
            <div><h2 className="text-2xl font-black">Venue tables</h2><p className="mt-1 text-sm text-slate-500">A quick view of your floor.</p></div>
            <Link href="/tables" className="text-sm font-bold text-cyan-300">Manage tables →</Link>
          </div>
          <TableManager compact />
        </section>
      </div>
    </main>
  );
}
