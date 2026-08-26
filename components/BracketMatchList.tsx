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
  waiting: "bg-white/5 text-slate-500 ring-white/10",
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

  return (
    <article className={`overflow-hidden rounded-2xl border bg-slate-950/65 ${state === "live" ? "border-cyan-400/35 shadow-[0_0_26px_rgba(34,211,238,.08)]" : automaticAdvance ? "border-violet-400/20" : "border-white/10"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] px-4 py-2.5">
        <span className="text-[0.66rem] font-black uppercase tracking-[0.16em] text-slate-500">
          {match.tableNumber ? `Table ${match.tableNumber} · ` : ""}Match #{matchNumber}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] ring-1 ${statusStyles[state]} ${state === "live" ? "animate-pulse" : ""}`}>
          {statusLabels[state]}
        </span>
      </div>

      {players.map((player, index) => {
        const isWinner = Boolean(match.completed && match.winner && player === match.winner);
        const isPlaceholder = !(index === 0 ? match.player1 : match.player2);
        return (
          <div key={`${match.id}-${index}`} className={`flex min-h-12 items-center gap-3 border-b border-white/10 px-4 py-2.5 ${isWinner ? "bg-emerald-400/10" : ""}`}>
            <span className={`min-w-0 flex-1 truncate text-sm font-black ${isWinner ? "text-emerald-300" : isPlaceholder ? automaticAdvance ? "text-slate-600" : "text-slate-500" : "text-white"}`}>
              {player}
            </span>
            <span className="text-base font-black tabular-nums text-cyan-300">{scores[index] ?? "—"}</span>
          </div>
        );
      })}

      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-xs font-bold text-slate-500">
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
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h3 className="font-black text-white">{round.name}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">{completed}/{round.matches.length} shown matches resolved</p>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-lg text-slate-400 transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="grid gap-3 border-t border-white/10 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
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
      <header className="border-b border-white/10 px-5 py-5 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Single Elimination</p>
            <p className="mt-1 text-xs text-slate-500">Every fixture grouped by round for faster mobile viewing.</p>
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
              className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-black transition ${filter === key ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-slate-400 ring-1 ring-white/10 hover:text-white"}`}
            >
              {label} <span className={filter === key ? "text-slate-700" : "text-slate-600"}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </header>

      {visibleRounds.length ? (
        <div className="space-y-3 p-3 sm:p-5">
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
