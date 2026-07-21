import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";

const platformFeatures = [
  {
    number: "01",
    title: "Tournament engine",
    text: "Single elimination, double elimination, Round Robin, Swiss, Free For All and groups-to-finals.",
  },
  {
    number: "02",
    title: "Live match control",
    text: "Score races, assign tables, track match time and keep the whole room informed.",
  },
  {
    number: "03",
    title: "Cloud spectators",
    text: "Publish a public link so players can follow brackets, standings and champions anywhere.",
  },
  {
    number: "04",
    title: "Venue operations",
    text: "Manage active tables, waiting players and the next-match queue from one control room.",
  },
];

const poolFeatures = [
  ["Table queue", "Reduce dead time and keep every available table moving."],
  ["Hill-hill alerts", "Highlight deciding frames when the pressure is highest."],
  ["TV mode", "Turn a venue television into a live tournament board."],
  ["Hall of champions", "Preserve winners and tournament history automatically."],
  ["League management", "Create fixtures, enter scores and calculate standings."],
  ["Cloud backup", "Keep tournament changes protected beyond one browser."],
];

const workflow = [
  ["01", "Build the field", "Choose the format and add your players."],
  ["02", "Run the room", "Generate the bracket, assign tables and score every race."],
  ["03", "Share the action", "Open the public link on phones, TVs and projector screens."],
  ["04", "Crown the champion", "Finish the event and save the winner in history."],
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#020617] text-white">
      <AppHeader />

      <main>
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.15),transparent_28rem),radial-gradient(circle_at_88%_6%,rgba(59,130,246,0.14),transparent_26rem)]" />

          <div className="cb-shell relative grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.03fr_.97fr] lg:gap-16 lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.2em] text-emerald-300">
                <span className="cb-live-dot" />
                Built for real pool nights
              </div>

              <h1 className="mt-6 max-w-4xl text-[clamp(2.65rem,11vw,5.6rem)] font-black leading-[0.94] tracking-[-0.055em]">
                Run the table.
                <span className="mt-1 block cb-text-gradient">
                  We run the tournament.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
                One mobile-friendly control room for brackets, live scores,
                venue tables, leagues and cloud spectators.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:flex">
                <Link
                  href="/tournaments/new"
                  className="flex min-h-13 items-center justify-center rounded-2xl bg-cyan-400 px-6 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/15 transition hover:bg-cyan-300"
                >
                  Create a tournament →
                </Link>
                <Link
                  href="/dashboard"
                  className="flex min-h-13 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-6 py-3.5 text-sm font-black text-white transition hover:bg-white/[0.08]"
                >
                  Open control room
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                {[
                  ["6+", "Formats"],
                  ["Live", "Scoring"],
                  ["Cloud", "Viewing"],
                ].map(([value, label]) => (
                  <div key={label} className="px-2 text-center">
                    <p className="text-lg font-black text-white sm:text-xl">{value}</p>
                    <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-auto w-full max-w-xl">
              <div className="cb-card overflow-hidden rounded-[1.75rem] p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <p className="cb-kicker">Live control room</p>
                    <h2 className="mt-1 text-lg font-black sm:text-xl">
                      Kasarani Open · Race to 4
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-[0.65rem] font-black uppercase text-emerald-300">
                    <span className="cb-live-dot" />
                    Live
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.045] p-4">
                  <div className="flex items-center justify-between text-[0.63rem] font-black uppercase tracking-[0.16em] text-slate-500">
                    <span>Table 3</span>
                    <span className="text-cyan-300">Winners semi-final</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {[["GM", "Gm", "3"], ["SK", "SK", "2"]].map(
                      ([initials, name, score], index) => (
                        <div
                          key={name}
                          className="flex min-h-14 items-center gap-3 rounded-xl bg-slate-950/65 px-3"
                        >
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-[0.68rem] font-black text-cyan-200">
                            {initials}
                          </span>
                          <strong className="flex-1 text-sm">{name}</strong>
                          <span
                            className={`grid h-10 w-10 place-items-center rounded-xl text-lg font-black ${
                              index === 0
                                ? "bg-cyan-400 text-slate-950"
                                : "bg-white/[0.06] text-white"
                            }`}
                          >
                            {score}
                          </span>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-300/10 bg-amber-300/[0.055] px-3 py-2 text-xs text-amber-200">
                    <span>GM is on the hill</span>
                    <span className="text-slate-500">18:42</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-500">
                      Table queue
                    </p>
                    <div className="mt-3 space-y-3 text-xs">
                      {[
                        ["1", "Ben vs Sam", "Playing"],
                        ["2", "Wicky vs Sez", "Next"],
                        ["4", "Available", "Free"],
                      ].map(([table, match, status]) => (
                        <div key={table} className="flex items-center gap-3">
                          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.05] font-black">
                            {table}
                          </span>
                          <span className="flex-1 font-bold text-slate-300">
                            {match}
                          </span>
                          <span className="text-[0.58rem] font-black uppercase tracking-wider text-cyan-300">
                            {status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-slate-500">
                        Progress
                      </p>
                      <strong className="text-cyan-200">68%</strong>
                    </div>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-900">
                      <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      13 of 19 matches completed
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 py-14 sm:py-20">
          <div className="cb-shell">
            <p className="cb-kicker">One tournament operating system</p>
            <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              More than a bracket generator.
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-slate-400">
              CueBracket connects the organizer, players, venue and spectators
              so every part of the pool night moves together.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {platformFeatures.map((feature) => (
                <article
                  key={feature.number}
                  className="cb-card rounded-3xl p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-xs font-black text-cyan-300">
                      {feature.number}
                    </span>
                    <span className="text-slate-600">↗</span>
                  </div>
                  <h3 className="mt-5 text-xl font-black">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {feature.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 py-14 sm:py-20">
          <div className="cb-shell">
            <p className="cb-kicker">Made specifically for cue sports</p>
            <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.035em] sm:text-5xl">
              Details generic tournament apps miss.
            </h2>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {poolFeatures.map(([title, text], index) => (
                <article
                  key={title}
                  className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"
                >
                  <span className="text-xs font-black text-cyan-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="cb-shell">
            <div className="text-center">
              <p className="cb-kicker">From draw to trophy</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] sm:text-5xl">
                Four steps. One smooth pool night.
              </h2>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {workflow.map(([step, title, text]) => (
                <article
                  key={step}
                  className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"
                >
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-cyan-300">
                    Step {step}
                  </p>
                  <h3 className="mt-5 text-lg font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
                </article>
              ))}
            </div>

            <div className="mt-12 rounded-[2rem] border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.08] to-blue-500/[0.04] px-5 py-10 text-center sm:px-10 sm:py-14">
              <p className="cb-kicker">Ready when the players are</p>
              <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                Your next tournament deserves a better control room.
              </h2>
              <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-400">
                Create the field, start scoring and share the live bracket in minutes.
              </p>
              <div className="mx-auto mt-7 grid max-w-xl gap-3 min-[390px]:grid-cols-2">
                <Link
                  href="/tournaments/new"
                  className="flex min-h-13 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3.5 text-sm font-black text-slate-950"
                >
                  Start a tournament
                </Link>
                <Link
                  href="/auth/signup"
                  className="flex min-h-13 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3.5 text-sm font-black"
                >
                  Create organizer account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="cb-shell flex flex-col gap-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-400 text-xs font-black text-slate-950">
              8
            </span>
            <span>
              <strong className="text-white">CueBracket Pro</strong> · Built for better pool nights.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 min-[390px]:flex">
            <Link href="/tournaments" className="hover:text-white">Tournaments</Link>
            <Link href="/leagues" className="hover:text-white">Leagues</Link>
            <Link href="/cloud" className="hover:text-white">Cloud</Link>
            <Link href="/auth/login" className="hover:text-white">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
