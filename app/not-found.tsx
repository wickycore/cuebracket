import Link from "next/link";

import { AppHeader } from "@/components/AppHeader";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-[#020617] text-white">
      <AppHeader />
      <div className="cb-shell grid min-h-[calc(100dvh-4.5rem)] place-items-center py-12">
        <section className="cb-card w-full max-w-2xl rounded-[2.4rem] p-8 text-center sm:p-12">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-cyan-300/20 bg-cyan-400/10 text-3xl font-black text-cyan-200">404</span>
          <p className="cb-kicker mt-7">Page not found</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">That shot missed the pocket.</h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-300">The link may be old, private or removed. Your tournaments and account data are safe.</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/events" className="rounded-2xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950">Discover events</Link>
            <Link href="/dashboard" className="rounded-2xl border border-white/10 px-6 py-3.5 font-black text-slate-200">Open dashboard</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
