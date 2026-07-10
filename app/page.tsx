import Link from "next/link";

const features = [
  {
    icon: "🎱",
    title: "Live Scores",
    text: "Update match results once and keep players and spectators informed.",
  },
  {
    icon: "🏆",
    title: "Smart Brackets",
    text: "Build organized single-life and double-life tournaments for any pool night.",
  },
  {
    icon: "🌍",
    title: "Share Anywhere",
    text: "Give everyone one clean link to follow the tournament from any device.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-[-18rem] right-[-10rem] h-[30rem] w-[30rem] rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <nav className="relative border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-xl font-black tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20">
              8
            </span>
            CueBracket <span className="text-cyan-400">Pro</span>
          </Link>

          <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 sm:gap-4">
            <Link href="/dashboard" className="rounded-xl px-3 py-2 hover:bg-white/5 hover:text-white">
              Dashboard
            </Link>
            <Link href="/tournaments" className="hidden rounded-xl px-3 py-2 hover:bg-white/5 hover:text-white sm:block">
              Tournaments
            </Link>
            <Link href="/tournaments/new" className="rounded-xl bg-cyan-400 px-4 py-2 text-slate-950 hover:bg-cyan-300">
              Create
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative mx-auto max-w-7xl px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-28">
        <div className="mx-auto max-w-4xl">
          <span className="inline-flex rounded-full bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300 ring-1 ring-cyan-400/20">
            Built for pool tournaments
          </span>
          <h1 className="mt-8 text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
            Run every match with
            <span className="block bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">
              complete control.
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-400 sm:text-xl">
            Create tournaments, manage players, organize brackets and prepare live results from one professional dashboard.
          </p>

          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/tournaments/new" className="rounded-2xl bg-cyan-400 px-7 py-4 font-black text-slate-950 shadow-xl shadow-cyan-400/15 hover:bg-cyan-300">
              Create Tournament
            </Link>
            <Link href="/dashboard" className="rounded-2xl border border-white/15 bg-white/5 px-7 py-4 font-black text-white hover:bg-white/10">
              Open Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-5 text-left md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl">
              <span className="text-3xl">{feature.icon}</span>
              <h2 className="mt-5 text-xl font-black">{feature.title}</h2>
              <p className="mt-2 leading-7 text-slate-400">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="relative border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500">
        © 2026 CueBracket Pro. Built for better pool nights.
      </footer>
    </main>
  );
}
