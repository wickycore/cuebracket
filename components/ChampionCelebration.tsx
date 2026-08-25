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
      <div className="relative mx-auto h-[8rem] max-w-4xl sm:h-[9rem]">
        <p className="absolute inset-x-0 top-0 text-[9px] font-black uppercase tracking-[0.22em] text-amber-300 sm:text-[11px]">{eyebrow}</p>

        <div className="absolute inset-x-0 bottom-5 top-5 grid grid-cols-[1fr_1.22fr_1fr] items-end gap-2 sm:bottom-6 sm:top-6 sm:gap-4">
          {podium?.runnerUp ? (
            <div className="flex h-[3.8rem] min-w-0 flex-col items-center justify-center rounded-t-[1rem] border-x border-t border-slate-200/30 bg-gradient-to-b from-slate-200/[0.09] to-slate-950/20 px-1.5 sm:h-[4.5rem] sm:rounded-t-[1.25rem]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/70 bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#cbd5e1_38%,#64748b_72%,#334155_100%)] text-[11px] font-black text-slate-950 shadow-[inset_0_1px_2px_rgba(255,255,255,0.85),0_2px_8px_rgba(148,163,184,0.28)] sm:h-9 sm:w-9 sm:text-sm">#2</span>
              <p className="mt-1 w-full truncate text-[11px] font-black text-slate-100 sm:text-base" title={podium.runnerUp}>{podium.runnerUp}</p>
            </div>
          ) : <div />}

          <div className="relative flex h-[5rem] min-w-0 flex-col items-center justify-center rounded-t-[1.15rem] border-x border-t border-amber-300/45 bg-gradient-to-b from-amber-300/[0.11] via-white/[0.025] to-slate-950/25 px-1.5 shadow-[0_-8px_24px_rgba(251,191,36,0.07)] sm:h-[5.75rem] sm:rounded-t-[1.5rem]">
            <span className="absolute -top-4 text-2xl leading-none sm:-top-5 sm:text-3xl" aria-hidden="true">🏆</span>
            <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-100/80 bg-[radial-gradient(circle_at_30%_25%,#fff7bd_0%,#facc15_38%,#b45309_72%,#78350f_100%)] text-[11px] font-black text-slate-950 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_10px_rgba(251,191,36,0.32)] sm:h-9 sm:w-9 sm:text-sm">#1</span>
            <h2 className="mt-0.5 w-full truncate text-xl font-black text-white sm:text-3xl">{champion}</h2>
            <p className="text-[10px] font-black text-amber-200 sm:text-xs">Congrats, champ!</p>
          </div>

          {thirdPlace ? (
            <div className="flex h-[3.8rem] min-w-0 flex-col items-center justify-center rounded-t-[1rem] border-x border-t border-orange-300/30 bg-gradient-to-b from-orange-300/[0.08] to-slate-950/20 px-1.5 sm:h-[4.5rem] sm:rounded-t-[1.25rem]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-orange-100/60 bg-[radial-gradient(circle_at_30%_25%,#fed7aa_0%,#fb923c_38%,#9a3412_72%,#431407_100%)] text-[11px] font-black text-slate-950 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7),0_2px_8px_rgba(251,146,60,0.25)] sm:h-9 sm:w-9 sm:text-sm">#3</span>
              <p className="mt-1 line-clamp-2 w-full text-[10px] font-black leading-3 text-orange-100 sm:text-sm sm:leading-4" title={thirdPlace}>{thirdPlace}</p>
            </div>
          ) : <div />}
        </div>

        <p className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl truncate text-[10px] leading-4 text-slate-300 sm:text-sm sm:leading-5" title={description}>{description}</p>
      </div>
    </section>
  );
}
