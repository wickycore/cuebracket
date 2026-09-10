import Link from "next/link";

export function PublicLandingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-[120] border-b border-white/10 bg-[#020617]/95 backdrop-blur-xl">
      <div className="cb-safe-top mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-black text-white" aria-label="CueBracket home">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20">8</span>
          <span className="text-base tracking-tight">CueBracket Pro</span>
        </Link>
        <nav aria-label="Public navigation" className="hidden items-center gap-1 lg:flex">
          {[["Live", "/events"], ["Clubs", "/clubs"], ["Marketplace", "/marketplace"], ["Rankings", "/rankings"], ["Champions", "/hall-of-champions"]].map(([label, href]) => (
            <Link key={label} href={href} className="rounded-xl px-3 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5 hover:text-white">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/events" aria-label="Search CueBracket" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2"/><path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </Link>
          {signedIn ? <Link href="/dashboard" className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-300">My dashboard</Link> : <><Link href="/auth/login" className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/5 min-[390px]:inline-flex">Sign in</Link><Link href="/auth/signup" className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-300">Join free</Link></>}
        </div>
      </div>
    </header>
  );
}
