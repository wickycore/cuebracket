import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3 font-black tracking-tight">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400 text-xl text-slate-950 shadow-lg shadow-cyan-400/20">
            8
          </span>
          <span className="text-xl text-white">
            CueBracket <span className="text-cyan-400">Pro</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2 text-sm font-semibold text-slate-300 sm:gap-4">
          <Link href="/dashboard" className="rounded-xl px-3 py-2 hover:bg-white/5 hover:text-white">
            Dashboard
          </Link>
          <Link href="/tournaments" className="hidden rounded-xl px-3 py-2 hover:bg-white/5 hover:text-white sm:block">
            Tournaments
          </Link>
          <Link
            href="/tournaments/new"
            className="rounded-xl bg-cyan-400 px-4 py-2 text-slate-950 transition hover:bg-cyan-300"
          >
            + New
          </Link>
        </nav>
      </div>
    </header>
  );
}
