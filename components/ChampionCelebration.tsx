import { getTournamentPodium, type Tournament } from "@/lib/tournaments";

export function ChampionCelebration({
  champion,
  description = "The tournament is complete.",
  eyebrow = "Tournament Champion",
  tournament,
}: {
  champion: string;
  description?: string;
  eyebrow?: string;
  tournament?: Tournament;
}) {
  const podium = tournament ? getTournamentPodium(tournament) : null;
  const thirdPlace = podium?.thirdPlace.join(" & ") ?? null;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-gradient-to-br from-amber-300/15 via-white/[0.04] to-cyan-400/10 p-5 text-center shadow-[0_24px_80px_rgba(251,191,36,0.08)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
        <span className="absolute left-[8%] top-7 h-2 w-2 rotate-45 bg-amber-300" />
        <span className="absolute right-[11%] top-12 h-2 w-2 rotate-45 bg-cyan-300" />
        <span className="absolute bottom-10 left-[18%] h-1.5 w-1.5 rounded-full bg-violet-300" />
        <span className="absolute bottom-8 right-[19%] h-1.5 w-1.5 rounded-full bg-emerald-300" />
      </div>
      <div className="relative mx-auto max-w-4xl">
        {podium?.runnerUp ? (
          <div className="absolute left-0 top-1/2 w-[25%] -translate-y-1/2 text-center">
            <span className="mx-auto grid h-7 w-7 place-items-center rounded-full border border-slate-200/40 bg-slate-200/10 text-[11px] font-black text-slate-200 sm:h-8 sm:w-8">#2</span>
            <p className="mt-1 truncate text-xs font-black text-slate-200 sm:text-base">{podium.runnerUp}</p>
          </div>
        ) : null}

        {thirdPlace ? (
          <div className="absolute right-0 top-1/2 w-[25%] -translate-y-1/2 text-center">
            <span className="mx-auto grid h-7 w-7 place-items-center rounded-full border border-orange-300/40 bg-orange-300/10 text-[11px] font-black text-orange-200 sm:h-8 sm:w-8">#3</span>
            <p className="mt-1 line-clamp-2 text-xs font-black leading-4 text-orange-100 sm:text-base" title={thirdPlace}>{thirdPlace}</p>
          </div>
        ) : null}

        <div className="mx-auto w-[50%] min-w-0">
          <div className="text-3xl leading-none sm:text-4xl" aria-hidden="true">🏆</div>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-300 sm:text-[11px]">{eyebrow}</p>
          <div className="mt-1 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-black text-amber-200">#1</div>
          <h2 className="mt-0.5 truncate text-2xl font-black text-white sm:text-4xl">{champion}</h2>
          <p className="mt-0.5 text-[11px] font-black text-amber-200 sm:text-sm">Congrats, champ!</p>
        </div>
        <p className="mx-auto mt-1 max-w-2xl truncate px-[24%] text-[10px] leading-4 text-slate-300 sm:text-sm sm:leading-5">{description}</p>
      </div>
    </section>
  );
}
