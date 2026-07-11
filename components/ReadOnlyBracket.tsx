"use client";

import { useRef } from "react";
import { BracketRound, Tournament, formatDuration } from "@/lib/tournaments";
import {
  BracketConnections,
  useBracketMatchRefs,
  type ConnectorTone,
} from "@/components/BracketConnections";
import { BracketViewport } from "@/components/BracketViewport";
import { ChampionCelebration } from "@/components/ChampionCelebration";

type Tone = "cyan" | "rose" | "violet";

const connectorTone: Record<Tone, ConnectorTone> = {
  cyan: "cyan",
  rose: "rose",
  violet: "violet",
};

const toneClass: Record<Tone, { title: string; panel: string }> = {
  cyan: {
    title: "text-cyan-300",
    panel: "from-cyan-400/[0.08] via-slate-950/90 to-slate-950/95",
  },
  rose: {
    title: "text-rose-300",
    panel: "from-rose-400/[0.07] via-slate-950/90 to-slate-950/95",
  },
  violet: {
    title: "text-violet-300",
    panel: "from-violet-400/[0.09] via-slate-950/90 to-slate-950/95",
  },
};

function Section({
  title,
  subtitle,
  rounds,
  raceTo,
  tone = "cyan",
}: {
  title: string;
  subtitle?: string;
  rounds: BracketRound[];
  raceTo: number;
  tone?: Tone;
}) {
  const colors = toneClass[tone];
  const maxMatches = Math.max(1, ...rounds.map((round) => round.matches.length));
  const contentRef = useRef<HTMLDivElement>(null);
  const { matchRefs, registerMatch } = useBracketMatchRefs();

  return (
    <section className={`mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br ${colors.panel}`}>
      <header className="border-b border-white/10 px-5 py-5 sm:px-7">
        <p className={`text-sm font-black uppercase tracking-[0.2em] ${colors.title}`}>{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </header>

      <BracketViewport label={title}>
        <div
          ref={contentRef}
          className="relative flex min-w-max snap-x snap-mandatory items-start gap-14 pb-4 pr-12"
        >
          <BracketConnections
            rounds={rounds}
            containerRef={contentRef}
            matchRefs={matchRefs}
            tone={connectorTone[tone]}
          />
          {rounds.map((round) => {
            const ratio = Math.max(1, Math.floor(maxMatches / Math.max(1, round.matches.length)));
            const topPadding = ratio > 1 ? Math.min(96, (ratio - 1) * 28) : 0;
            const gap = ratio > 1 ? Math.min(120, ratio * 30) : 18;

            return (
              <div key={`${title}-${round.round}`} className="w-64 shrink-0 snap-start">
                <p className="mb-4 text-[11px] font-black uppercase tracking-[0.17em] text-slate-500">{round.name}</p>
                <div style={{ paddingTop: topPadding, display: "grid", gap }}>
                  {round.matches.map((match) => (
                    <div
                      key={match.id}
                      ref={(node) => registerMatch(match.id, node)}
                      className="relative z-10"
                    >
                      <article className={`group relative z-10 overflow-hidden rounded-xl border bg-slate-950/95 shadow-[0_14px_40px_rgba(0,0,0,.28)] transition-all duration-300 hover:-translate-y-0.5 ${match.completed ? "border-emerald-400/45 shadow-[0_0_24px_rgba(52,211,153,.08)]" : match.status === "live" ? "border-cyan-400/45 shadow-[0_0_30px_rgba(34,211,238,.12)]" : "border-white/10"}`}>
                        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-3 py-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{match.tableNumber ? `Table ${match.tableNumber}` : `Match ${match.position}`}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${match.completed ? "bg-emerald-400/10 text-emerald-300" : match.status === "live" ? "animate-pulse bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30" : match.player1 && match.player2 ? "bg-cyan-400/10 text-cyan-300" : "bg-white/5 text-slate-500"}`}>
                            {match.completed ? "Finished" : match.status === "live" ? "● Live" : match.player1 && match.player2 ? "Ready" : "Waiting"}
                          </span>
                        </div>
                        {[match.player1, match.player2].map((player, index) => {
                          const winner = Boolean(match.completed && player && match.winner === player);
                          const score = index === 0 ? match.score1 : match.score2;
                          return (
                            <div key={index} className={`flex min-h-12 items-center gap-3 border-b border-white/10 px-3 py-2.5 last:border-b-0 ${winner ? "bg-emerald-400/10" : ""}`}>
                              <span className={`min-w-0 flex-1 truncate text-sm font-extrabold ${winner ? "text-emerald-300" : player ? "text-white" : "text-slate-600"}`}>{player ?? "TBD"}</span>
                              <span className="text-sm font-black tabular-nums text-cyan-300">{score ?? "—"}</span>
                            </div>
                          );
                        })}
                        <div className="flex min-h-10 items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold text-slate-500">
                          <span>Race to {raceTo}</span>
                          <span>{match.startedAt ? formatDuration(new Date(match.endedAt ?? Date.now()).getTime() - new Date(match.startedAt).getTime()) : match.completed ? `Winner: ${match.winner}` : ""}</span>
                        </div>
                      </article>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </BracketViewport>
    </section>
  );
}

export function ReadOnlyBracket({ tournament }: { tournament: Tournament }) {
  const bracket = tournament.bracket;

  if (!bracket) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
        <p className="text-4xl">🧩</p>
        <h2 className="mt-3 text-2xl font-black">Bracket not generated yet</h2>
      </section>
    );
  }

  if (bracket.type === "double") {
    const allRounds = [...bracket.winners, ...bracket.losers, ...bracket.grandFinal.filter((round) => round.round === 1 || bracket.resetRequired)];
    const allMatches = allRounds.flatMap((round) => round.matches);
    const completed = allMatches.filter((match) => match.completed).length;
    const progress = allMatches.length ? Math.round((completed / allMatches.length) * 100) : 0;

    return (
      <div>
        <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/55 p-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Live tournament progress</p>
              <p className="mt-1 text-sm font-bold text-white">{completed} of {allMatches.length} matches completed</p>
            </div>
            <p className="text-2xl font-black tabular-nums text-cyan-300">{progress}%</p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {bracket.champion ? <div className="mt-6"><ChampionCelebration champion={bracket.champion} /></div> : null}

        <Section
          title="Winners Bracket"
          subtitle="Players remain here until their first loss."
          rounds={bracket.winners}
          raceTo={tournament.raceTo}
          tone="cyan"
        />
        <Section
          title="Losers Bracket"
          subtitle="A second loss eliminates the player."
          rounds={bracket.losers}
          raceTo={tournament.raceTo}
          tone="rose"
        />
        <Section
          title="Grand Final"
          subtitle={bracket.resetRequired ? "Bracket reset active." : "Winners champion versus losers champion."}
          rounds={bracket.grandFinal.filter((round) => round.round === 1 || bracket.resetRequired)}
          raceTo={tournament.raceTo}
          tone="violet"
        />
      </div>
    );
  }

  return (
    <Section
      title="Single Elimination"
      rounds={bracket.rounds}
      raceTo={tournament.raceTo}
      tone="cyan"
    />
  );
}
