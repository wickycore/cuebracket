import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

const platformFeatures = [
  {
    number: "01",
    title: "Tournament engine",
    text: "Single and double elimination, automatic BYEs, winner advancement and bracket reset support.",
    accent: "from-cyan-400/18 to-blue-500/5",
  },
  {
    number: "02",
    title: "Live match control",
    text: "Score races frame by frame, assign tables, track match time and keep the whole room informed.",
    accent: "from-emerald-400/16 to-cyan-500/5",
  },
  {
    number: "03",
    title: "Cloud spectators",
    text: "Publish a public link and let players follow brackets, scores and champions from any device.",
    accent: "from-blue-500/18 to-indigo-500/5",
  },
  {
    number: "04",
    title: "Venue operations",
    text: "See table availability, active matches, waiting players and the next match queue in one place.",
    accent: "from-amber-400/14 to-orange-500/5",
  },
];

const poolFeatures = [
  ["Table queue", "Keep every pool table moving and reduce dead time between matches."],
  ["Hill-hill moments", "Highlight deciding frames so spectators know where the pressure is."],
  ["TV mode", "Turn any venue television into a live tournament information board."],
  ["Hall of champions", "Preserve winners, final brackets and tournament history automatically."],
  ["League management", "Create fixtures, enter scores and calculate standings in the same platform."],
  ["Cloud backup", "Tournament changes sync online so the event is not trapped on one browser."],
];

const workflow = [
  { step: "01", title: "Build the field", text: "Name the event, choose the format and add your players." },
  { step: "02", title: "Run the room", text: "Generate the bracket, assign tables and score every race." },
  { step: "03", title: "Share the action", text: "Open the live link on phones, TVs and projector screens." },
  { step: "04", title: "Crown the champion", text: "Finish the bracket and save the event in tournament history." },
];

export default function Home() {
  return (
    <main className="cb-app-bg text-white">
      <AppHeader />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[8%] top-12 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-[4%] top-28 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
        </div>

        <div className="cb-shell relative grid min-h-[calc(100vh-4.5rem)] items-center gap-16 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:py-24">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-cyan-400/[0.07] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
              <span className="cb-live-dot" />
              Built for real pool nights
            </div>

            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Run the table.
              <span className="cb-text-gradient mt-2 block">We run the tournament.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
              CueBracket Pro gives organizers one professional control room for brackets, live scores,
              venue tables, leagues and cloud spectators.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tournaments/new"
                className="cb-shimmer inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-7 py-4 font-black text-slate-950 shadow-2xl shadow-cyan-400/15 transition hover:-translate-y-0.5 hover:bg-cyan-300"
              >
                Create a tournament
                <span className="ml-2">→</span>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.045] px-7 py-4 font-black text-white transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
              >
                Open control room
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {[
                ["2", "Elimination formats"],
                ["Live", "Realtime scoring"],
                ["Cloud", "Public brackets"],
              ].map(([value, label]) => (
                <div key={label} className="border-l border-white/10 pl-4 first:border-cyan-400/40">
                  <p className="text-xl font-black text-white">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-cyan-400/12 via-blue-500/5 to-transparent blur-3xl" />
            <div className="cb-card relative overflow-hidden rounded-[2rem] p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
                <div>
                  <p className="cb-kicker">Live control room</p>
                  <h2 className="mt-2 text-xl font-black">Kasarani Open · Race to 4</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-300">
                  <span className="cb-live-dot" /> Live
                </span>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
                <div className="rounded-3xl border border-cyan-400/18 bg-cyan-400/[0.045] p-5">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    <span>Table 3</span>
                    <span className="text-cyan-300">Winners semi-final</span>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-950/60 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-xs font-black text-cyan-200">GM</span>
                        <span className="font-black">Gm</span>
                      </div>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950">3</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-950/60 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-xs font-black text-slate-300">SK</span>
                        <span className="font-black">SK</span>
                      </div>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-xl font-black text-white ring-1 ring-white/10">2</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm">
                    <span className="font-bold text-amber-200">GM is on the hill</span>
                    <span className="font-mono text-xs text-slate-400">18:42</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-slate-950/48 p-5">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Table queue</p>
                    <div className="mt-4 space-y-3">
                      {[
                        ["1", "Ben vs Sam", "Playing"],
                        ["2", "Wicky vs Sez", "Next"],
                        ["4", "Available", "Free"],
                      ].map(([table, match, state]) => (
                        <div key={table} className="flex items-center gap-3">
                          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-xs font-black text-slate-300">{table}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-200">{match}</span>
                          <span className={`text-[0.65rem] font-black uppercase tracking-wider ${state === "Playing" ? "text-emerald-300" : state === "Next" ? "text-cyan-300" : "text-slate-500"}`}>
                            {state}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-cyan-400/[0.04] p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tournament progress</p>
                      <span className="text-lg font-black text-cyan-200">68%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/70">
                      <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">13 of 19 matches completed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.018]">
        <div className="cb-shell grid grid-cols-2 gap-px py-5 text-center sm:grid-cols-3 lg:grid-cols-6">
          {["Brackets", "Live scores", "Tables", "Leagues", "TV mode", "Cloud backup"].map((item) => (
            <div key={item} className="px-3 py-3 text-xs font-black uppercase tracking-[0.13em] text-slate-500">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="cb-shell py-24 sm:py-28">
        <div className="max-w-3xl">
          <p className="cb-kicker">One tournament operating system</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            More than a bracket generator.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-400">
            CueBracket connects the organizer, players, venue and spectators so every part of the pool night moves together.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {platformFeatures.map((feature) => (
            <article
              key={feature.title}
              className={`cb-card cb-card-hover relative overflow-hidden rounded-[2rem] bg-gradient-to-br ${feature.accent} p-7 sm:p-8`}
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="font-mono text-xs font-black tracking-[0.2em] text-cyan-300">{feature.number}</p>
                  <h3 className="mt-5 text-2xl font-black">{feature.title}</h3>
                  <p className="mt-3 max-w-xl leading-7 text-slate-400">{feature.text}</p>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl text-cyan-200">↗</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-950/45 py-24 sm:py-28">
        <div className="cb-shell grid gap-14 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="cb-kicker">Made specifically for cue sports</p>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              The details generic tournament apps miss.
            </h2>
            <p className="mt-5 leading-8 text-slate-400">
              Pool halls need table flow, player calls, race scoring and a screen everyone in the room can understand instantly.
            </p>
            <Link href="/dashboard" className="mt-7 inline-flex items-center font-black text-cyan-300 hover:text-cyan-200">
              Explore the control room <span className="ml-2">→</span>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {poolFeatures.map(([title, text], index) => (
              <article key={title} className="cb-card cb-card-hover rounded-3xl p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/10 font-mono text-xs font-black text-cyan-200 ring-1 ring-cyan-400/15">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-slate-700">●</span>
                </div>
                <h3 className="mt-5 text-xl font-black">{title}</h3>
                <p className="mt-2 leading-7 text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cb-shell py-24 sm:py-28">
        <div className="text-center">
          <p className="cb-kicker">From draw to trophy</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Four steps. One smooth pool night.</h2>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-4">
          {workflow.map((item, index) => (
            <article key={item.step} className="relative rounded-3xl border border-white/10 bg-white/[0.025] p-6">
              {index < workflow.length - 1 ? (
                <span className="absolute -right-3 top-10 z-10 hidden h-px w-6 bg-cyan-400/30 lg:block" />
              ) : null}
              <span className="font-mono text-xs font-black tracking-[0.2em] text-cyan-300">STEP {item.step}</span>
              <h3 className="mt-5 text-xl font-black">{item.title}</h3>
              <p className="mt-3 leading-7 text-slate-400">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cb-shell pb-24 sm:pb-28">
        <div className="cb-card relative overflow-hidden rounded-[2.5rem] border-cyan-400/20 px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.14),_transparent_58%)]" />
          <div className="relative">
            <p className="cb-kicker">Ready when the players are</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
              Your next tournament deserves a better control room.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-400">
              Create the field, start scoring and share the live bracket in minutes.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/tournaments/new" className="rounded-2xl bg-cyan-400 px-7 py-4 font-black text-slate-950 hover:bg-cyan-300">
                Start a tournament
              </Link>
              <Link href="/auth/signup" className="rounded-2xl border border-white/15 bg-white/[0.04] px-7 py-4 font-black text-white hover:bg-white/[0.08]">
                Create organizer account
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950/55">
        <div className="cb-shell flex flex-col gap-6 py-9 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950">8</span>
            <span><strong className="text-slate-300">CueBracket Pro</strong> · Built for better pool nights.</span>
          </div>
          <div className="flex flex-wrap gap-5 font-bold">
            <Link href="/tournaments" className="hover:text-white">Tournaments</Link>
            <Link href="/leagues" className="hover:text-white">Leagues</Link>
            <Link href="/cloud" className="hover:text-white">Cloud</Link>
            <Link href="/auth/login" className="hover:text-white">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
