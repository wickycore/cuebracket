"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getSpectatorMatchState,
  matchesSpectatorFilter,
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
  raceTo,
  now,
}: {
  match: BracketMatch;
  matchNumber: number;
  matchNumbers: Map<string, number>;
  raceTo: number;
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
      <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-5">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
          {match.tableNumber ? `Table ${match.tableNumber} · ` : ""}Match #{matchNumber}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.09em] ring-1 ${statusStyles[state]} ${state === "live" ? "animate-pulse" : ""}`}>
          {statusLabels[state]}
        </span>
      </div>

      <div className="grid min-h-[4.75rem] grid-cols-[minmax(0,1fr)_2.25rem_1.5rem_2.25rem_minmax(0,1fr)] items-center gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_3rem_2rem_3rem_minmax(0,1fr)] sm:px-5">
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

      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-white/[0.07] px-4 py-2 text-sm font-bold text-slate-400 sm:px-5">
        <span>{automaticAdvance ? "Automatic advance · no match played" : `Race to ${raceTo}`}</span>
        {elapsed ? <span className={state === "live" ? "text-cyan-300" : ""}>{elapsed}</span> : null}
      </div>
    </article>
  );
}

function RoundGroup({
  round,
  raceTo,
  matchNumbers,
  now,
}: {
  round: BracketRound;
  raceTo: number;
  matchNumbers: Map<string, number>;
  now: number;
}) {
  const [open, setOpen] = useState(true);
  const completed = round.matches.filter((match) => match.completed).length;

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <h3 className="text-lg font-black text-white">{round.name}</h3>
          <p className="mt-1 text-sm font-bold text-slate-400">{completed}/{round.matches.length} shown matches resolved</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-xl text-slate-300 ring-1 ring-white/10 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="divide-y divide-white/10 border-t border-white/10">
        {round.matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            matchNumber={matchNumbers.get(match.id) ?? match.position + 1}
            matchNumbers={matchNumbers}
            raceTo={raceTo}
            now={now}
          />
        ))}
      </div>
    </details>
  );
}

export function BracketMatchList({ rounds, raceTo }: { rounds: BracketRound[]; raceTo: number }) {
  const [filter, setFilter] = useState<SpectatorMatchFilter>("all");
  const [now, setNow] = useState(() => Date.now());
  const allMatches = useMemo(() => rounds.flatMap((round) => round.matches), [rounds]);
  const matchNumbers = useMemo(() => numberBracketMatches(rounds), [rounds]);
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
    .map((round) => ({ ...round, matches: round.matches.filter((match) => matchesSpectatorFilter(match, filter)) }))
    .filter((round) => round.matches.length);

  return (
    <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-cyan-400/[0.06] via-slate-950/90 to-slate-950/95">
      <header className="border-b border-white/10 px-4 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-black uppercase tracking-[0.16em] text-cyan-300">Single Elimination</p>
            <p className="mt-1 text-sm font-medium text-slate-400">One match per row, grouped by round.</p>
          </div>
          {counts.live ? <span className="w-fit rounded-full bg-rose-400/15 px-3 py-1.5 text-xs font-black text-rose-300 ring-1 ring-rose-400/25">● {counts.live} live now</span> : null}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter tournament matches">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-black transition ${filter === key ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:text-white"}`}
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
            />
          ))}
        </div>
      ) : (
        <div className="px-6 py-16 text-center">
          <p className="text-3xl">🎱</p>
          <p className="mt-3 font-black text-white">No {filter} matches right now.</p>
          <button type="button" onClick={() => setFilter("all")} className="mt-3 text-sm font-black text-cyan-300">Show every match</button>
        </div>
      )}
    </section>
  );
}
