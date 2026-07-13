import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DashboardActivity } from "@/components/DashboardActivity";
import { LeagueList } from "@/components/LeagueList";
import { OrganizerOverview } from "@/components/OrganizerOverview";
import { TableManager } from "@/components/TableManager";
import { TournamentList } from "@/components/TournamentList";

const quickActions = [
  {
    href: "/tournaments/new",
    title: "Create tournament",
    text: "Build a single or double elimination field.",
    symbol: "+",
    tone: "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-200",
  },
  {
    href: "/leagues/new",
    title: "Create league",
    text: "Generate fixtures and automatic standings.",
    symbol: "L",
    tone: "border-blue-400/20 bg-blue-400/[0.06] text-blue-200",
  },
  {
    href: "/tables",
    title: "Manage tables",
    text: "Control the venue floor and match queue.",
    symbol: "T",
    tone: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200",
  },
  {
    href: "/cloud",
    title: "Cloud center",
    text: "Check backups, privacy and spectator links.",
    symbol: "C",
    tone: "border-violet-400/20 bg-violet-400/[0.06] text-violet-200",
  },
];

export default function DashboardPage() {
  return (
    <main className="cb-app-bg text-white">
      <AppHeader />

      <div className="cb-shell py-8 sm:py-10">
        <section className="cb-card relative overflow-hidden rounded-[2.3rem] p-6 sm:p-9 lg:p-10">
          <div className="pointer-events-none absolute -right-20 -top-36 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-12rem] left-[20%] h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />

          <div className="relative grid gap-9 lg:grid-cols-[1fr_0.66fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                <span className="cb-live-dot" /> Organizer control room online
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.035em] sm:text-5xl lg:text-6xl">
                Everything needed to run the whole pool night.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-400">
                Start events, monitor live matches, manage the venue floor and keep every spectator connected from one screen.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/tournaments/new"
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950 shadow-xl shadow-cyan-400/12 transition hover:-translate-y-0.5 hover:bg-cyan-300"
                >
                  + Create tournament
                </Link>
                <Link
                  href="/tournaments"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-3.5 font-black text-white transition hover:bg-white/[0.08]"
                >
                  Open tournament library
                </Link>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/48 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="cb-kicker">Tonight&apos;s stack</p>
                  <h2 className="mt-2 text-xl font-black">Control every layer</h2>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/10 font-black text-cyan-200 ring-1 ring-cyan-400/20">
                  8
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Draw", "Build brackets"],
                  ["Score", "Run matches"],
                  ["Floor", "Assign tables"],
                  ["Share", "Go live"],
                ].map(([label, text], index) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white">{label}</span>
                      <span className="font-mono text-[0.62rem] text-slate-600">0{index + 1}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group rounded-3xl border p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06] ${action.tone}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950/35 text-sm font-black ring-1 ring-white/10">
                  {action.symbol}
                </span>
                <span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-current">→</span>
              </div>
              <h2 className="mt-4 font-black text-white">{action.title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{action.text}</p>
            </Link>
          ))}
        </section>

        <div className="mt-6">
          <OrganizerOverview />
        </div>

        <div className="mt-12 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="min-w-0">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cb-kicker">Event control</p>
                <h2 className="mt-2 text-3xl font-black">Recent tournaments</h2>
                <p className="mt-1 text-sm text-slate-500">Continue drafts, score live events or reopen completed brackets.</p>
              </div>
              <Link href="/tournaments" className="text-sm font-black text-cyan-300 hover:text-cyan-200">
                View library →
              </Link>
            </div>
            <TournamentList compact limit={6} showControls={false} />
          </section>

          <DashboardActivity />
        </div>

        <section className="mt-14">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="cb-kicker">Season play</p>
              <h2 className="mt-2 text-3xl font-black">Your leagues</h2>
              <p className="mt-1 text-sm text-slate-500">Fixtures, results and tables across longer competitions.</p>
            </div>
            <Link href="/leagues" className="text-sm font-black text-cyan-300 hover:text-cyan-200">
              Manage leagues →
            </Link>
          </div>
          <LeagueList compact />
        </section>

        <section className="mt-14 grid gap-6 lg:grid-cols-[1fr_0.42fr]">
          <div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="cb-kicker">Venue floor</p>
                <h2 className="mt-2 text-3xl font-black">Pool tables</h2>
                <p className="mt-1 text-sm text-slate-500">See what is free, occupied or reserved before the queue slows down.</p>
              </div>
              <Link href="/tables" className="text-sm font-black text-cyan-300 hover:text-cyan-200">
                Manage floor →
              </Link>
            </div>
            <TableManager compact />
          </div>

          <aside className="cb-card relative overflow-hidden rounded-[2rem] p-7">
            <div className="absolute -right-12 -top-12 text-[9rem] leading-none text-amber-300/[0.035]">♛</div>
            <div className="relative">
              <p className="cb-kicker text-amber-300">Tournament history</p>
              <h2 className="mt-3 text-3xl font-black">Every champion deserves a wall.</h2>
              <p className="mt-3 leading-7 text-slate-400">
                Revisit title winners, final brackets and the events that made the room stop and watch.
              </p>
              <Link
                href="/hall-of-champions"
                className="mt-7 inline-flex rounded-2xl bg-amber-300 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-200"
              >
                Open Hall of Champions
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
