import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-black text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-slate-950">8</span>
          <span className="hidden sm:inline">CueBracket Pro</span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto text-sm font-bold text-slate-400">
          <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">Dashboard</Link>
          <Link href="/tournaments" className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">Tournaments</Link>
          <Link href="/leagues" className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">Leagues</Link>
          <Link href="/cloud" className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white">Cloud</Link>
          <AuthNav />
        </nav>
      </div>
    </header>
  );
}
