import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { TournamentList } from "@/components/TournamentList";

export default function TournamentsPage() {
  return (
    <main className="cb-app-bg text-white">
      <AppHeader />
      <div className="cb-shell py-8 sm:py-10">
        <section className="cb-card relative overflow-hidden rounded-[2.2rem] p-7 sm:p-9">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="cb-kicker">Tournament library</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Every event in one command shelf.</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
                Search players and venues, track progress, reopen completed brackets or continue the tournament currently on the table.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/cloud"
                className="rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3 text-center font-black text-slate-200 hover:bg-white/[0.08]"
              >
                Cloud center
              </Link>
              <Link
                href="/tournaments/new"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-black text-slate-950 shadow-lg shadow-cyan-400/10 hover:bg-cyan-300"
              >
                + New tournament
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <TournamentList />
        </section>
      </div>
    </main>
  );
}
