import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LeagueList } from "@/components/LeagueList";

export default function LeaguesPage() {
  return (
    <main className="cb-app-bg text-white">
      <AppHeader />
      <div className="cb-shell py-8 sm:py-10">
        <section className="cb-card relative overflow-hidden rounded-[2.2rem] p-7 sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="cb-kicker">League operations</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">A full season, without the spreadsheet chaos.</h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
                Build fixtures, enter race scores and let CueBracket calculate the standings after every result.
              </p>
            </div>
            <Link
              href="/leagues/new"
              className="rounded-2xl bg-cyan-400 px-5 py-3 text-center font-black text-slate-950 shadow-lg shadow-cyan-400/10 hover:bg-cyan-300"
            >
              + Create league
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <LeagueList />
        </section>
      </div>
    </main>
  );
}
