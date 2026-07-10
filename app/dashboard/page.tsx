import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { TournamentList } from "@/components/TournamentList";

const stats = [
  { label: "Active", value: "—", helper: "Live tournaments" },
  { label: "Players", value: "—", helper: "Across tournaments" },
  { label: "Matches", value: "—", helper: "Results managed" },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-400">Organizer dashboard</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Manage every tournament.</h1>
            <p className="mt-4 max-w-2xl text-slate-400">
              Create events, reopen drafts and keep multiple tournaments organized from one place.
            </p>
          </div>

          <Link href="/tournaments/new" className="rounded-2xl bg-cyan-400 px-6 py-3.5 text-center font-black text-slate-950 hover:bg-cyan-300">
            + Create Tournament
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-bold text-slate-500">{stat.label}</p>
              <p className="mt-2 text-3xl font-black">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.helper}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 mt-12 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Your tournaments</h2>
            <p className="mt-1 text-sm text-slate-500">Draft, live and completed events.</p>
          </div>
          <Link href="/tournaments" className="text-sm font-bold text-cyan-300 hover:text-cyan-200">
            View all →
          </Link>
        </div>

        <TournamentList />
      </div>
    </main>
  );
}
