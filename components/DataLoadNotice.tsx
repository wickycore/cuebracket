"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DataLoadNotice({ title = "We could not load this information", detail = "Your data has not been changed. Check your connection and try again." }: { title?: string; detail?: string }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  return (
    <section role="alert" className="rounded-[2rem] border border-amber-300/25 bg-amber-300/[0.07] p-6 text-left sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Connection problem</p>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{detail}</p>
      <button type="button" disabled={retrying} onClick={() => { setRetrying(true); router.refresh(); window.setTimeout(() => setRetrying(false), 2500); }} className="mt-5 min-h-11 rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-slate-950 disabled:opacity-60">
        {retrying ? "Trying again…" : "Try again"}
      </button>
    </section>
  );
}
