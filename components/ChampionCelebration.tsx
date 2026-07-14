export function ChampionCelebration({
  champion,
  description = "The tournament is complete.",
  eyebrow = "Tournament Champion",
}: {
  champion: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-amber-300/25 bg-gradient-to-br from-amber-300/15 via-white/[0.04] to-cyan-400/10 p-7 text-center shadow-[0_24px_80px_rgba(251,191,36,0.08)] sm:p-10">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
        <span className="absolute left-[8%] top-7 h-2 w-2 rotate-45 bg-amber-300" />
        <span className="absolute right-[11%] top-12 h-2 w-2 rotate-45 bg-cyan-300" />
        <span className="absolute bottom-10 left-[18%] h-1.5 w-1.5 rounded-full bg-violet-300" />
        <span className="absolute bottom-8 right-[19%] h-1.5 w-1.5 rounded-full bg-emerald-300" />
      </div>
      <div className="relative">
        <div className="text-5xl" aria-hidden="true">🏆</div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-amber-300">{eyebrow}</p>
        <h2 className="mt-3 text-4xl font-black text-white sm:text-5xl">{champion}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p>
      </div>
    </section>
  );
}
