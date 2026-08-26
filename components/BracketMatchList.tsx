"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getActiveSpectatorRound,
  getSpectatorMatchState,
  matchesSpectatorFilter,
  matchesSpectatorPlayer,
  numberBracketMatches,
  spectatorSourceLabel,
  type SpectatorMatchFilter,
  type SpectatorMatchState,
} from "@/lib/bracket/spectator";
import { formatDuration, type BracketMatch, type BracketRound } from "@/lib/tournaments";

const filters: Array<{ key: SpectatorMatchFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

const statusStyles: Record<SpectatorMatchState, string> = {
  advanced: "bg-violet-400/10 text-violet-200 ring-violet-400/20",
  finished: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  live: "bg-rose-400/15 text-rose-300 ring-rose-400/30",
  ready: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/20",
  waiting: "bg-white/5 text-slate-300 ring-white/10",
};

const rowAccentStyles: Record<SpectatorMatchState, string> = {
  advanced: "border-l-violet-400/60",
  finished: "border-l-emerald-400/70",
  live: "border-l-rose-400",
  ready: "border-l-cyan-400/70",
  waiting: "border-l-slate-700",
};

const statusLabels: Record<SpectatorMatchState, string> = {
  advanced: "Advanced",
  finished: "Finished",
  live: "● Live",
  ready: "Ready",
  waiting: "Waiting",
};

function MatchRow({
  match,
  matchNumber,
  matchNumbers,
  now,
}: {
  match: BracketMatch;
  matchNumber: number;
  matchNumbers: Map<string, number>;
  now: number;
}) {
  const state = getSpectatorMatchState(match);
  const automaticAdvance = state === "advanced";
  const players = [
    match.player1 ?? (automaticAdvance ? "No opponent" : spectatorSourceLabel(match.source1, matchNumbers)),
    match.player2 ?? (automaticAdvance ? "No opponent" : spectatorSourceLabel(match.source2, matchNumbers)),
  ];
  const scores = [match.score1, match.score2];
  const elapsed = match.startedAt
    ? formatDuration(
        (match.endedAt ? new Date(match.endedAt).getTime() : now) -
          new Date(match.startedAt).getTime(),
      )
    : "";

  function playerStyle(index: number) {
    const player = players[index];
    const isWinner = Boolean(match.completed && match.winner && player === match.winner);
    const isPlaceholder = !(index === 0 ? match.player1 : match.player2);
    if (isWinner) return "text-emerald-300";
    if (!isPlaceholder) return "text-white";
    return automaticAdvance ? "text-slate-500" : "text-slate-300";
  }

  return (
    <article className={`border-l-[3px] bg-slate-950/45 transition hover:bg-white/[0.035] ${rowAccentStyles[state]} ${state === "live" ? "shadow-[inset_0_0_30px_rgba(34,211,238,.045)]" : ""}`}>
      <div className="flex items-center justify-between gap-3 px-3 pt-2.5 sm:px-5 sm:pt-3">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
          {match.tableNumber ? `Table ${match.tableNumber} · ` : ""}Match #{matchNumber}
        </span>
        <div className="flex items-center gap-2">
          {elapsed ? <span className={`text-xs font-black tabular-nums ${state === "live" ? "text-cyan-300" : "text-slate-500"}`}>{elapsed}</span> : null}
          <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.09em] ring-1 ${statusStyles[state]} ${state === "live" ? "animate-pulse" : ""}`}>
            {statusLabels[state]}
          </span>
        </div>
      </div>

      <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_2.25rem_1.5rem_2.25rem_minmax(0,1fr)] items-center gap-1 px-3 py-2.5 sm:min-h-[4.25rem] sm:grid-cols-[minmax(0,1fr)_3rem_2rem_3rem_minmax(0,1fr)] sm:px-5 sm:py-3">
        <span className={`min-w-0 break-words text-left text-base font-black leading-5 sm:text-lg sm:leading-6 ${playerStyle(0)}`}>
          {players[0]}
        </span>
        <span className="text-center text-xl font-black tabular-nums text-cyan-300 sm:text-2xl">{scores[0] ?? "—"}</span>
        <span className="text-center text-xs font-black uppercase text-slate-600">vs</span>
        <span className="text-center text-xl font-black tabular-nums text-cyan-300 sm:text-2xl">{scores[1] ?? "—"}</span>
        <span className={`min-w-0 break-words text-right text-base font-black leading-5 sm:text-lg sm:leading-6 ${playerStyle(1)}`}>
          {players[1]}
        </span>
      </div>

      {automaticAdvance ? <p className="border-t border-white/[0.07] px-3 py-2 text-xs font-bold text-violet-200/75 sm:px-5">Automatic advance · no match played</p> : null}
    </article>
  );
}

function RoundGroup({
  round,
  raceTo,
  matchNumbers,
  now,
  open,
  forceOpen,
  onOpenChange,
}: {
  round: BracketRound;
  raceTo: number;
  matchNumbers: Map<string, number>;
  now: number;
  open: boolean;
  forceOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const completed = round.matches.filter((match) => match.completed).length;

  return (
    <details
      id={`spectator-round-${round.round}`}
      open={forceOpen || open}
      onToggle={(event) => {
        if (!forceOpen) onOpenChange(event.currentTarget.open);
      }}
      className="group scroll-mt-24 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-base font-black text-white sm:text-lg">{round.name}</h3>
            <span className="text-xs font-black text-cyan-300">Race to {raceTo}</span>
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-400 sm:text-sm">{completed}/{round.matches.length} shown matches resolved</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-lg text-slate-300 ring-1 ring-white/10 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="divide-y divide-white/10 border-t border-white/10">
        {round.matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            matchNumber={matchNumbers.get(match.id) ?? match.position + 1}
            matchNumbers={matchNumbers}
            now={now}
          />
        ))}
      </div>
    </details>
  );
}

export function BracketMatchList({ rounds, raceTo }: { rounds: BracketRound[]; raceTo: number }) {
  const [filter, setFilter] = useState<SpectatorMatchFilter>("all");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const allMatches = useMemo(() => rounds.flatMap((round) => round.matches), [rounds]);
  const matchNumbers = useMemo(() => numberBracketMatches(rounds), [rounds]);
  const activeRound = useMemo(() => getActiveSpectatorRound(rounds), [rounds]);
  const [roundOpenOverrides, setRoundOpenOverrides] = useState<Map<number, boolean>>(
    () => new Map(),
  );
  const hasLiveMatches = allMatches.some((match) => getSpectatorMatchState(match) === "live");

  useEffect(() => {
    if (!hasLiveMatches) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasLiveMatches]);

  const counts = useMemo(() => Object.fromEntries(
    filters.map(({ key }) => [key, allMatches.filter((match) => matchesSpectatorFilter(match, key)).length]),
  ) as Record<SpectatorMatchFilter, number>, [allMatches]);
  const visibleRounds = rounds
    .map((round) => ({
      ...round,
      matches: round.matches.filter(
        (match) => matchesSpectatorFilter(match, filter) && matchesSpectatorPlayer(match, query),
      ),
    }))
    .filter((round) => round.matches.length);
  const visibleMatchCount = visibleRounds.reduce((total, round) => total + round.matches.length, 0);
  const forceRoundsOpen = Boolean(query.trim()) || filter !== "all";

  function jumpToRound(roundNumber: number) {
    setRoundOpenOverrides((current) => new Map(current).set(roundNumber, true));
    window.requestAnimationFrame(() => {
      document.getElementById(`spectator-round-${roundNumber}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function toggleRound(roundNumber: number, open: boolean) {
    setRoundOpenOverrides((current) => new Map(current).set(roundNumber, open));
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-cyan-400/[0.06] via-slate-950/90 to-slate-950/95 sm:mt-6 sm:rounded-[1.75rem]">
      <header className="border-b border-white/10 px-3 py-4 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-black uppercase tracking-[0.16em] text-cyan-300">Single Elimination</p>
            <p className="mt-1 text-xs font-medium text-slate-400 sm:text-sm">Find a player or jump straight to a round.</p>
          </div>
          {counts.live ? <span className="w-fit rounded-full bg-rose-400/15 px-3 py-1.5 text-xs font-black text-rose-300 ring-1 ring-rose-400/25">● {counts.live} live now</span> : null}
        </div>

        <div className="relative mt-3">
          <label htmlFor="spectator-player-search" className="sr-only">Find a player</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-500">⌕</span>
          <input
            id="spectator-player-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player — e.g. Wicky"
            className="min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/80 pl-10 pr-10 text-base font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15"
          />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear player search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white">×</button> : null}
        </div>
        {query.trim() ? <p className="mt-2 text-xs font-bold text-cyan-300">{visibleMatchCount} {visibleMatchCount === 1 ? "match" : "matches"} found</p> : null}

        <div className="mt-3">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-500">Jump to round</p>
          <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
            {rounds.map((round) => (
              <button
                key={round.round}
                type="button"
                onClick={() => jumpToRound(round.round)}
                className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-black ring-1 transition ${round.round === activeRound ? "bg-cyan-400/10 text-cyan-300 ring-cyan-400/25" : "bg-white/5 text-slate-300 ring-white/10 hover:text-white"}`}
              >
                {round.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter tournament matches">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`min-h-10 shrink-0 rounded-xl px-3.5 py-2 text-sm font-black transition ${filter === key ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:text-white"}`}
            >
              {label} <span className={filter === key ? "text-slate-700" : "text-slate-600"}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </header>

      {visibleRounds.length ? (
        <div className="space-y-3 p-2 sm:p-5">
          {visibleRounds.map((round) => (
            <RoundGroup
              key={`${filter}-${round.round}`}
              round={round}
              raceTo={raceTo}
              matchNumbers={matchNumbers}
              now={now}
              open={roundOpenOverrides.get(round.round) ?? round.round === activeRound}
              forceOpen={forceRoundsOpen}
              onOpenChange={(open) => toggleRound(round.round, open)}
            />
          ))}
        </div>
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="text-3xl">🎱</p>
          <p className="mt-3 font-black text-white">{query.trim() ? `No matches found for “${query.trim()}”.` : `No ${filter} matches right now.`}</p>
          <button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="mt-3 text-sm font-black text-cyan-300">Show every match</button>
        </div>
      )}
    </section>
  );
}
