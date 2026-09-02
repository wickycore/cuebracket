export default function Loading() {
  return (
    <main className="min-h-dvh bg-[#020617] text-white" aria-busy="true" aria-label="Loading CueBracket">
      <div className="h-16 border-b border-white/10 bg-[#020617] sm:h-[4.5rem]" />
      <div className="cb-shell py-8 sm:py-12">
        <div className="h-5 w-32 animate-pulse rounded-full bg-cyan-300/10" />
        <div className="mt-4 h-12 w-3/4 max-w-xl animate-pulse rounded-2xl bg-white/[0.07]" />
        <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-full bg-white/[0.045]" />
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.035]" />)}
        </div>
      </div>
    </main>
  );
}
