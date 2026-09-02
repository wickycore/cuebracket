"use client";

import { useEffect } from "react";

import { AppHeader } from "@/components/AppHeader";

export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="min-h-dvh bg-[#020617] text-white">
      <AppHeader />
      <div className="cb-shell grid min-h-[calc(100dvh-4.5rem)] place-items-center py-12">
        <section role="alert" className="cb-card w-full max-w-2xl rounded-[2.4rem] p-8 text-center sm:p-12">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.6rem] border border-amber-300/20 bg-amber-300/10 text-4xl">↻</span>
          <p className="cb-kicker mt-7 !text-amber-300">Temporary problem</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">CueBracket could not finish loading.</h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-300">Nothing was deleted or reset. Try loading this section again.</p>
          <button type="button" onClick={() => unstable_retry()} className="mt-7 rounded-2xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950">Try again</button>
        </section>
      </div>
    </main>
  );
}
