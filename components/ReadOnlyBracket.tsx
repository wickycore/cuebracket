"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  BracketMatch,
  BracketRound,
  Tournament,
  TournamentBracket,
  formatDuration,
  getTournamentChampionDescription,
} from "@/lib/tournaments";
import {
  BracketConnections,
  useBracketMatchRefs,
  type ConnectorTone,
} from "@/components/BracketConnections";
import { BracketViewport } from "@/components/BracketViewport";
import { BracketMatchList } from "@/components/BracketMatchList";
import { ChampionCelebration } from "@/components/ChampionCelebration";

type SingleBracketView = "flowchart" | "list";
const SPECTATOR_VIEW_KEY = "cuebracket:spectator-bracket-view:v2";
const SPECTATOR_VIEW_EVENT = "cuebracket:spectator-bracket-view-change";

function subscribeToSpectatorView(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SPECTATOR_VIEW_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SPECTATOR_VIEW_EVENT, onStoreChange);
  };
}

function getSpectatorViewSnapshot(): SingleBracketView {
  const savedView = window.localStorage.getItem(SPECTATOR_VIEW_KEY);
  if (savedView === "list" || savedView === "flowchart") return savedView;
  return window.matchMedia("(max-width: 767px)").matches ? "list" : "flowchart";
}

function getServerSpectatorViewSnapshot(): SingleBracketView {
  return "flowchart";
}

type Tone = "cyan" | "rose" | "violet";

const connectorTone: Record<Tone, ConnectorTone> = {
  cyan: "cyan",
  rose: "rose",
  violet: "violet",
};

const toneClass: Record<Tone, { title: string; panel: string }> = {
  cyan: {
    title: "text-[#52d3ee]",
    panel: "from-[#123763] via-[#0d2a50] to-[#071a35]",
  },
  rose: {
    title: "text-[#efb5bf]",
    panel: "from-[#3a2445] via-[#182c50] to-[#071a35]",
  },
  violet: {
    title: "text-[#ddd6fe]",
    panel: "from-[#30295d] via-[#182c50] to-[#071a35]",
  },
};

function isAutomaticAdvance(match: BracketMatch) {
  return match.completed && Boolean(match.player1) !== Boolean(match.player2);
}

function buildBalancedCenters(rounds: BracketRound[], maxMatches: number) {
  const centers = new Map<string, number>();

  rounds.forEach((round) => {
    const fallbackSpan = maxMatches / Math.max(1, round.matches.length);

    round.matches.forEach((match) => {
      const feederCenters = [match.source1, match.source2]
        .flatMap((source) => {
          if (!source || source.kind === "seed") return [];
          const center = centers.get(source.matchId);
          return center === undefined ? [] : [center];
        })
        .filter((center, index, values) => values.indexOf(center) === index);

      const center = feederCenters.length
        ? feederCenters.reduce((total, value) => total + value, 0) /
          feederCenters.length
        : match.position * fallbackSpan + (fallbackSpan - 1) / 2;

      centers.set(match.id, center);
    });
  });

  return centers;
}

function Section({
  title,
  subtitle,
  rounds,
  raceTo,
  tone = "cyan",
  balancedGeometry = false,
  playerPlaceholders,
  showHeader = true,
  edgeToEdge = false,
}: {
  title: string;
  subtitle?: string;
  rounds: BracketRound[];
  raceTo: number;
  tone?: Tone;
  balancedGeometry?: boolean;
  playerPlaceholders?: [string, string];
  showHeader?: boolean;
  edgeToEdge?: boolean;
}) {
  const colors = toneClass[tone];
  const maxMatches = Math.max(1, ...rounds.map((round) => round.matches.length));
  const matchHeight = 145;
  const matchPitch = 162;
  const bracketBodyHeight = matchHeight + (maxMatches - 1) * matchPitch;
  const balancedCenters = balancedGeometry
    ? buildBalancedCenters(rounds, maxMatches)
    : new Map<string, number>();
  const contentRef = useRef<HTMLDivElement>(null);
  const { matchRefs, registerMatch } = useBracketMatchRefs();
  const hasLiveTimer = rounds.some((round) =>
    round.matches.some((match) => match.startedAt && !match.endedAt),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasLiveTimer) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasLiveTimer]);

  return (
    <section className={`${edgeToEdge ? "-mx-3 mt-3 rounded-none border-y sm:mx-0 sm:mt-6 sm:rounded-[1.75rem] sm:border" : "mt-6 rounded-[1.75rem] border"} overflow-hidden border-[#2a5680] bg-gradient-to-br ${colors.panel}`}>
      {showHeader ? <header className="border-b border-[#2a5680] px-5 py-5 sm:px-7">
        <p className={`text-sm font-black uppercase tracking-[0.2em] ${colors.title}`}>{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-[#b8c7dc]">{subtitle}</p> : null}
      </header> : null}

      <BracketViewport label={title}>
        <div
          ref={contentRef}
          className="relative isolate flex min-w-max snap-x snap-mandatory items-start gap-14 pb-4 pr-12"
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
              <div key={`${title}-${round.round}`} className="w-56 shrink-0 snap-start">
                <p className="mb-4 text-[11px] font-black uppercase tracking-[0.17em] text-[#dce8f4]">{round.name}</p>
                <div
                  style={
                    balancedGeometry
                      ? { position: "relative", height: bracketBodyHeight }
                      : { paddingTop: topPadding, display: "grid", gap }
                  }
                >
                  {round.matches.map((match) => {
                    const automaticAdvance = isAutomaticAdvance(match);
                    const advancingPlayer = match.player1 ?? match.player2 ?? match.winner;
                    const centerSlot =
                      balancedCenters.get(match.id) ?? match.position;

                    return (
                      <div
                        key={match.id}
                        ref={(node) => registerMatch(match.id, node)}
                        data-bracket-match-id={match.id}
                        className="relative z-10"
                        style={
                          balancedGeometry
                            ? {
                                position: "absolute",
                                left: 0,
                                right: 0,
                                top: matchHeight / 2 + centerSlot * matchPitch,
                                transform: "translateY(-50%)",
                              }
                            : undefined
                        }
                      >
                        {automaticAdvance ? (
                          <article data-bracket-card className="relative z-10 overflow-hidden rounded-xl border border-[#a78bfa]/45 bg-[#30295d] shadow-[0_10px_24px_rgba(0,0,0,.18)]">
                            <div className="flex items-center justify-between border-b border-[#a78bfa]/30 px-3 py-1.5">
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#e3dcff]">Automatic BYE</span>
                              <span className="rounded-full bg-[#a78bfa]/18 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#ede9fe]">Advanced</span>
                            </div>
                            <div className="flex min-h-10 items-center gap-3 border-b border-[#a78bfa]/30 px-3 py-1.5">
                              <span className="min-w-0 flex-1 truncate text-sm font-black text-[#fafcff]">{advancingPlayer}</span>
                              <span className="text-sm font-black text-[#ddd6fe]">✓</span>
                            </div>
                            <div className="flex min-h-10 items-center border-b border-[#a78bfa]/30 px-3 py-1.5 text-sm font-extrabold text-[#b8c7dc]">
                              No opponent
                            </div>
                            <div className="flex min-h-9 items-center px-3 py-1.5 text-[11px] font-bold text-[#e3dcff]">
                              Automatic advance
                            </div>
                          </article>
                        ) : (
                          <article data-bracket-card className={`group relative z-10 overflow-hidden rounded-xl border bg-[#123763] shadow-[0_10px_24px_rgba(0,0,0,.18)] transition-colors duration-200 ${match.completed ? "border-[#78c69b]/60" : match.status === "live" ? "border-[#ef8193]/65" : "border-[#356a98]"}`}>
                            <div className="flex items-center justify-between border-b border-[#2a5680] bg-[#11335d] px-3 py-1.5">
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#dce8f4]">{match.tableNumber ? `Table ${match.tableNumber}` : `Match ${match.position + 1}`}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${match.completed ? "bg-[#78c69b]/15 text-[#b9e7ca]" : match.status === "live" ? "bg-[#ef8193]/18 text-[#ffc2cb] ring-1 ring-[#ef8193]/40" : match.player1 && match.player2 ? "bg-[#27c2e6]/15 text-[#7ce8fb]" : "bg-[#1a426d] text-[#d2dfec]"}`}>
                                {match.completed ? "Finished" : match.status === "live" ? "● Live" : match.player1 && match.player2 ? "Ready" : "Waiting"}
                              </span>
                            </div>
                            {[match.player1, match.player2].map((player, index) => {
                              const winner = Boolean(match.completed && player && match.winner === player);
                              const score = index === 0 ? match.score1 : match.score2;
                              const placeholder = playerPlaceholders?.[index] ?? "TBD";
                              return (
                                <div key={index} className={`flex min-h-10 items-center gap-3 border-b border-[#2a5680] px-3 py-1.5 last:border-b-0 ${winner ? "bg-[#78c69b]/12" : ""}`}>
                                  <span className={`min-w-0 flex-1 truncate text-sm font-extrabold ${winner ? "text-[#b9e7ca]" : player ? "text-[#fafcff]" : playerPlaceholders ? "text-[#e3dcff]" : "text-[#b8c7dc]"}`}>{player ?? placeholder}</span>
                                  <span className="text-sm font-black tabular-nums text-[#52d3ee]">{score ?? "—"}</span>
                                </div>
                              );
                            })}
                            <div className="flex min-h-9 items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-bold text-[#d2dfec]">
                              <span>Race to {raceTo}</span>
                              <span>{match.startedAt ? formatDuration((match.endedAt ? new Date(match.endedAt).getTime() : now) - new Date(match.startedAt).getTime()) : ""}</span>
                            </div>
                          </article>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </BracketViewport>
    </section>
  );
}

export function ReadOnlyBracket({
  tournament,
  bracket: bracketOverride,
  showChampion = true,
}: {
  tournament: Tournament;
  bracket?: TournamentBracket;
  showChampion?: boolean;
}) {
  const bracket = bracketOverride ?? tournament.bracket;
  const singleView = useSyncExternalStore(
    subscribeToSpectatorView,
    getSpectatorViewSnapshot,
    getServerSpectatorViewSnapshot,
  );

  function selectSingleView(view: SingleBracketView) {
    window.localStorage.setItem(SPECTATOR_VIEW_KEY, view);
    window.dispatchEvent(new Event(SPECTATOR_VIEW_EVENT));
  }

  if (!bracket) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
        <p className="text-4xl">🧩</p>
        <h2 className="mt-3 text-2xl font-black">Bracket not generated yet</h2>
      </section>
    );
  }

  if (bracket.type === "double") {
    const allRounds = [
      ...bracket.winners,
      ...bracket.losers,
      ...bracket.grandFinal.filter((round) => round.round === 1 || bracket.resetRequired),
    ];
    const allMatches = allRounds.flatMap((round) => round.matches);
    const completed = allMatches.filter(
      (match) => match.completed && match.player1 && match.player2,
    ).length;
    const automaticAdvances = allMatches.filter(
      (match) => match.completed && !(match.player1 && match.player2),
    ).length;
    const automaticByes = allMatches.filter(isAutomaticAdvance).length;
    const totalPlayable = Math.max(completed, allMatches.length - automaticAdvances);
    const progress = bracket.champion
      ? 100
      : totalPlayable
        ? Math.min(100, Math.round((completed / totalPlayable) * 100))
        : 0;

    return (
      <div>
        <div className="rounded-[1.5rem] border border-[#2a5680] bg-[#0d2a50] p-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#dce8f4]">Live tournament progress</p>
              <p className="mt-1 text-sm font-bold text-[#fafcff]">{completed} of {totalPlayable} played matches completed</p>
              {automaticByes ? <p className="mt-1 text-xs font-bold text-violet-300">Automatic BYEs: {automaticByes}</p> : null}
            </div>
            <p className="text-2xl font-black tabular-nums text-[#52d3ee]">{progress}%</p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#11335d] ring-1 ring-[#356a98]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#27c2e6] via-[#a78bfa] to-[#78c69b] transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {showChampion && bracket.champion ? <div className="mt-6"><ChampionCelebration champion={bracket.champion} description={getTournamentChampionDescription(tournament)} tournament={tournament} /></div> : null}

        <Section
          title="Winners Bracket"
          subtitle="Players remain here until their first loss."
          rounds={bracket.winners}
          raceTo={tournament.raceTo}
          tone="cyan"
          balancedGeometry
        />
        <Section
          title="Losers Bracket"
          subtitle="A second loss eliminates the player."
          rounds={bracket.losers}
          raceTo={tournament.raceTo}
          tone="rose"
          balancedGeometry
        />
        <Section
          title="Grand Final"
          subtitle={
            bracket.resetRequired
              ? bracket.champion
                ? "The bracket-reset match decided the tournament champion."
                : "The bracket reset is active."
              : "Winners champion versus losers champion."
          }
          rounds={bracket.grandFinal.filter((round) => round.round === 1 || bracket.resetRequired)}
          raceTo={tournament.raceTo}
          tone="violet"
          balancedGeometry
          playerPlaceholders={[
            "Winners bracket winner",
            "Losers bracket winner",
          ]}
        />
      </div>
    );
  }

  const liveMatches = bracket.rounds.filter(Boolean).flatMap((round) => round.matches).filter(
    (match) => !match.completed && (match.status === "live" || Boolean(match.startedAt && !match.endedAt)),
  ).length;

  return (
    <div>
      {showChampion && bracket.champion ? <div className="mb-6"><ChampionCelebration champion={bracket.champion} description={getTournamentChampionDescription(tournament)} tournament={tournament} /></div> : null}
      <section className="rounded-xl border border-[#2a5680] bg-[#0d2a50] p-2 sm:rounded-[1.5rem] sm:p-4">
        <div className="flex items-center gap-1.5 sm:justify-between sm:gap-2">
          <div className="hidden px-1 sm:block">
            <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#dce8f4]">Tournament view</p>
            <p className="mt-1 text-sm font-bold text-[#d2dfec]">Choose the view that is easiest to follow.</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none sm:gap-2">
            {liveMatches ? <span className="hidden rounded-full bg-rose-400/15 px-3 py-1.5 text-xs font-black text-rose-300 ring-1 ring-rose-400/25 sm:inline">● {liveMatches} live</span> : null}
            <div className="grid flex-1 grid-cols-2 rounded-lg border border-[#356a98] bg-[#09213f] p-0.5 sm:flex-none sm:rounded-2xl sm:p-1" role="tablist" aria-label="Tournament display mode">
              <button
                type="button"
                role="tab"
                aria-selected={singleView === "flowchart"}
                onClick={() => selectSingleView("flowchart")}
                className={`min-h-8 rounded-lg px-2.5 text-[0.62rem] font-black transition sm:min-h-10 sm:rounded-xl sm:px-4 sm:text-xs ${singleView === "flowchart" ? "bg-[#27c2e6] text-[#071a35]" : "text-[#d2dfec] hover:text-[#fafcff]"}`}
              >
                ⑂ Flowchart
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={singleView === "list"}
                onClick={() => selectSingleView("list")}
                className={`min-h-8 rounded-lg px-2.5 text-[0.62rem] font-black transition sm:min-h-10 sm:rounded-xl sm:px-4 sm:text-xs ${singleView === "list" ? "bg-[#27c2e6] text-[#071a35]" : "text-[#d2dfec] hover:text-[#fafcff]"}`}
              >
                ☷ Match list
              </button>
            </div>
          </div>
        </div>
      </section>

      {singleView === "flowchart" ? (
        <>
          <p className="mt-3 text-center text-xs font-bold text-[#d2dfec] sm:hidden">Wide chart mode · drag sideways · pinch to zoom · double-tap to reset</p>
          <Section
            title="Single Elimination"
            rounds={bracket.rounds}
            raceTo={tournament.raceTo}
            tone="cyan"
            balancedGeometry
            showHeader={false}
            edgeToEdge
          />
        </>
      ) : (
        <BracketMatchList rounds={bracket.rounds} raceTo={tournament.raceTo} />
      )}
    </div>
  );
}
