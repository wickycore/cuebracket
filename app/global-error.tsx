"use client";

export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en"><body className="min-h-dvh bg-[#020617] text-white"><main className="grid min-h-dvh place-items-center px-5"><section className="max-w-xl rounded-[2rem] border border-white/10 bg-slate-900 p-8 text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">CueBracket recovery</p><h1 className="mt-3 text-3xl font-black">The app needs a fresh rack.</h1><p className="mt-3 text-slate-300">Your saved data has not been intentionally removed. Reload CueBracket to continue.</p><button type="button" onClick={() => unstable_retry()} className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Reload CueBracket</button></section></main></body></html>
  );
}
