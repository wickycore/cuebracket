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
  advanced: "bg-[#5b318d]/20 text-[#d9bcff] ring-[#a873ee]/80",
  finished: "bg-[#185843] text-[#9aebc6] ring-[#36b985]/35",
  live: "bg-[#642c3b] text-[#ff7485] ring-[#a84255]/40",
  ready: "bg-[#075968] text-[#67e7ed] ring-[#168798]/40",
  waiting: "bg-[#21364d] text-[#c6d4e4] ring-[#3b536d]",
};

const rowAccentStyles: Record<SpectatorMatchState, string> = {
  advanced: "bg-[#9b5de5]",
  finished: "bg-[#3bd198]",
  live: "bg-[#ff6075]",
  ready: "bg-[#3bd198]",
  waiting: "bg-[#5f7b99]",
};

const avatarStyles = [
  "bg-[#b83e59]",
  "bg-[#6b3fca]",
  "bg-[#2f9d62]",
  "bg-[#e89013]",
  "bg-[#27aaa3]",
  "bg-[#2f6fc9]",
];

const statusLabels: Record<SpectatorMatchState, string> = {
  advanced: "Advanced",
  finished: "Finished",
  live: "● Live",
  ready: "Ready",
  waiting: "Waiting",
};

function playerInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLowerCase();
  return words.slice(0, 2).map((word) => word[0]).join("").toLowerCase();
}

function playerAvatarStyle(name: string) {
  const colorIndex = Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0) % avatarStyles.length;
  return avatarStyles[colorIndex];
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserPlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M18 7v6M15 10h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const displayMatchNumber = String(matchNumber).padStart(2, "0");
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
    if (isWinner) return "text-[#a9d9bd]";
    if (!isPlaceholder) return "text-[#fafcff]";
    return automaticAdvance ? "text-[#9fb4ca]" : "text-[#d2dfec]";
  }

  function playerIdentity(index: number) {
    const player = players[index];
    const hasPlayer = Boolean(index === 0 ? match.player1 : match.player2);

    return (
      <div className={`flex min-w-0 items-center gap-1 sm:gap-3 ${index === 1 ? "flex-row-reverse text-right" : "text-left"}`}>
        {hasPlayer ? (
          <span
            aria-hidden="true"
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.55rem] font-black lowercase text-white ring-1 ring-white/15 sm:h-12 sm:w-12 sm:text-base ${playerAvatarStyle(player)}`}
          >
            {playerInitials(player)}
          </span>
        ) : null}
        <span className={`min-w-0 break-words text-[0.7rem] font-black leading-3 sm:text-lg sm:leading-6 ${playerStyle(index)}`}>
          {player}
        </span>
      </div>
    );
  }

  if (automaticAdvance) {
    const advancingPlayer = match.player1 ?? match.player2 ?? match.winner ?? "Advanced player";

    return (
      <article className="relative h-[5.625rem] overflow-hidden rounded-lg border border-[#3b3b61] bg-[linear-gradient(110deg,#17263f_0%,#18233b_52%,#151d34_100%)] shadow-[0_8px_22px_rgba(0,0,0,0.14)] sm:h-auto sm:rounded-xl sm:shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 sm:w-1.5 ${rowAccentStyles[state]}`} />
        <div className="flex h-[1.3125rem] items-center justify-between gap-2 px-2 sm:h-auto sm:gap-3 sm:px-7 sm:pt-4">
          <span className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#c1d0e2] sm:text-xs">
            {match.tableNumber ? `Table ${match.tableNumber} · ` : ""}Match {displayMatchNumber}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.06em] ring-1 sm:px-2.5 sm:py-1 sm:text-xs ${statusStyles[state]}`}>
            {statusLabels[state]}
          </span>
        </div>

        <div className="grid h-12 grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1.35fr)] items-center gap-1 px-2 py-0.5 sm:h-auto sm:min-h-[6.4rem] sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1.2fr)] sm:gap-1.5 sm:px-7 sm:py-4">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <span aria-hidden="true" className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.55rem] font-black uppercase text-white ring-1 ring-[#b17aff]/50 sm:h-12 sm:w-12 sm:text-base ${playerAvatarStyle(advancingPlayer)}`}>
              {playerInitials(advancingPlayer)}
            </span>
            <span className="min-w-0 break-words text-[0.7rem] font-black leading-3 text-[#fafcff] sm:text-lg sm:leading-6">{advancingPlayer}</span>
          </div>

          <span className="text-center text-sm font-black text-[#b9b5ca] sm:text-2xl">VS.</span>

          <div className="flex min-h-[1.875rem] min-w-0 items-center justify-center gap-0.5 rounded-lg border border-dashed border-[#a873ee] bg-[#281d42]/45 px-1 py-0.5 text-center text-[0.52rem] font-bold leading-3 text-[#d9cfee] sm:min-h-16 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm sm:leading-4" aria-label="Bye — no opponent">
            <span className="text-[#b17aff]"><UserPlusIcon /></span>
            <span><strong className="text-[#c798ff]">BYE</strong> — No opponent</span>
          </div>
        </div>

        <p className="flex h-[1.3125rem] items-center justify-center border-t border-[#3b3b61] px-2 text-center text-[0.55rem] font-bold text-[#d8b8ff] sm:block sm:h-auto sm:px-7 sm:py-2.5 sm:text-sm">
          <span className="whitespace-nowrap"><strong className="text-[#bd8cff]">Automatic advance</strong> · no match played</span>
        </p>
      </article>
    );
  }

  return (
    <article className="relative h-[5.15625rem] overflow-hidden rounded-lg border border-[#2c425a] bg-[linear-gradient(110deg,#172a43_0%,#152940_52%,#11243a_100%)] shadow-[0_8px_22px_rgba(0,0,0,0.14)] transition hover:border-[#3c5875] hover:bg-[linear-gradient(110deg,#1b314d_0%,#193049_52%,#152b44_100%)] sm:h-auto sm:rounded-xl sm:shadow-[0_10px_30px_rgba(0,0,0,0.14)]">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 sm:w-1.5 ${rowAccentStyles[state]}`} />
      <div className="grid h-[1.3125rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 px-2 sm:h-auto sm:gap-2 sm:px-7 sm:pt-4">
        <span className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#c1d0e2] sm:text-xs">
          {match.tableNumber ? `Table ${match.tableNumber} · ` : ""}Match {displayMatchNumber}
        </span>
        <span className="flex items-center justify-center gap-0.5 text-[0.62rem] font-black tabular-nums text-[#c4d2e3] sm:gap-1 sm:text-sm">
          {elapsed ? <><ClockIcon />{elapsed}</> : null}
        </span>
        <div className="flex items-center justify-end">
          <span className={`rounded-full px-2 py-0.5 text-[0.52rem] font-black uppercase tracking-[0.06em] ring-1 sm:px-2.5 sm:py-1 sm:text-xs ${statusStyles[state]}`}>
            {statusLabels[state]}
          </span>
        </div>
      </div>

      <div className="grid h-[2.53125rem] grid-cols-[minmax(0,1fr)_1.5rem_1.125rem_1.5rem_minmax(0,1fr)] items-center gap-0.5 px-2 py-0.5 sm:h-auto sm:min-h-[6.2rem] sm:grid-cols-[minmax(0,1fr)_3.5rem_2rem_3.5rem_minmax(0,1fr)] sm:gap-3 sm:px-7 sm:py-3">
        {playerIdentity(0)}
        <span className="text-center text-2xl font-black tabular-nums text-[#f8fbff] sm:text-4xl">{scores[0] ?? "—"}</span>
        <span className="text-center text-xs font-black uppercase text-[#aebdd0] sm:text-xl">vs</span>
        <span className="text-center text-2xl font-black tabular-nums text-[#f8fbff] sm:text-4xl">{scores[1] ?? "—"}</span>
        {playerIdentity(1)}
      </div>

      <p className="grid h-[1.3125rem] place-items-center border-t border-[#2c425a] px-2 text-center text-[0.62rem] font-medium text-[#b9c8da] sm:block sm:h-auto sm:px-7 sm:py-2 sm:text-sm">Race to {raceTo}</p>
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
  const progress = round.matches.length ? (completed / round.matches.length) * 100 : 0;

  return (
    <details
      id={`spectator-round-${round.round}`}
      open={forceOpen || open}
      onToggle={(event) => {
        if (!forceOpen) onOpenChange(event.currentTarget.open);
      }}
      className="group scroll-mt-24 overflow-hidden border-y border-[#263c54] bg-[#09192d] sm:rounded-2xl sm:border"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-7 sm:py-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3 sm:gap-y-2">
            <h3 className="text-[0.95rem] font-black text-[#f8fbff] sm:text-2xl">{round.name}</h3>
            <span className="rounded-md border border-[#2d435c] bg-[#1b2d45] px-2 py-0.5 text-[0.6rem] font-black text-[#cbd8e7] shadow-inner sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-sm">Race to {raceTo}</span>
          </div>
          <p className="mt-1.5 text-[0.7rem] font-bold text-[#c7d5e4] sm:mt-2 sm:text-base">{completed} / {round.matches.length} matches resolved</p>
          <span className="mt-1.5 block h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[#2b3c52] sm:mt-2 sm:h-2" aria-hidden="true">
            <span className="block h-full rounded-full bg-[#39d38f] transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </span>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#2d435c] bg-[#17283d] text-base text-[#edf5ff] shadow-inner transition group-open:rotate-180 sm:h-12 sm:w-12 sm:rounded-xl sm:text-xl">⌄</span>
      </summary>
      <div className="space-y-2 border-t border-[#263c54] px-2 py-2 sm:space-y-3 sm:px-5 sm:py-5">
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
    <section className="-mx-3 mt-2.5 overflow-hidden border-y border-[#263c54] bg-[#08172a] sm:mx-0 sm:mt-6 sm:rounded-[1.75rem] sm:border">
      <header className="border-b border-[#263c54] bg-[#0a1b30] px-2.5 py-3 sm:px-7 sm:py-6">
        {counts.live ? <span className="mb-3 block w-fit rounded-full bg-rose-400/15 px-3 py-1.5 text-xs font-black text-rose-300 ring-1 ring-rose-400/25">● {counts.live} live now</span> : null}

        <div className="relative mt-2 sm:mt-3">
          <label htmlFor="spectator-player-search" className="sr-only">Find a player</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#9fb4ca] sm:left-3 sm:text-lg">⌕</span>
          <input
            id="spectator-player-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player — e.g. Wicky"
            className="h-9 w-full rounded-lg border border-[#2d435c] bg-[#111f33] pl-8 pr-8 text-xs font-bold text-[#f8fbff] outline-none placeholder:text-[#8fa2b8] focus:border-[#39cbe8] focus:ring-2 focus:ring-[#39cbe8]/20 sm:min-h-11 sm:rounded-xl sm:pl-10 sm:pr-10 sm:text-base"
          />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear player search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#c7d5e4] hover:bg-[#1b2d45] hover:text-white">×</button> : null}
        </div>
        {query.trim() ? <p className="mt-2 text-xs font-bold text-[#52d3ee]">{visibleMatchCount} {visibleMatchCount === 1 ? "match" : "matches"} found</p> : null}

        <div className="mt-2 sm:mt-3">
          <p className="text-[0.55rem] font-black uppercase tracking-[0.16em] text-[#dce8f4] sm:text-[0.65rem]">Jump to round</p>
          <div className="mt-1 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-1.5 sm:gap-2">
            {rounds.map((round) => (
              <button
                key={round.round}
                type="button"
                onClick={() => jumpToRound(round.round)}
                className={`min-h-7 shrink-0 rounded-md px-2.5 text-[0.62rem] font-black ring-1 transition sm:min-h-9 sm:rounded-lg sm:px-3 sm:text-xs ${round.round === activeRound ? "bg-[#12566a] text-[#75e6ee] ring-[#238499]" : "bg-[#17283d] text-[#c7d5e4] ring-[#2d435c] hover:text-white"}`}
              >
                {round.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-3 sm:gap-2" role="tablist" aria-label="Filter tournament matches">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`min-h-8 shrink-0 rounded-lg px-2.5 py-1.5 text-[0.68rem] font-black transition sm:min-h-10 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm ${filter === key ? "bg-[#39cbe8] text-[#071a2d]" : "bg-[#17283d] text-[#c7d5e4] ring-1 ring-[#2d435c] hover:text-white"}`}
            >
              {label} <span className={filter === key ? "text-[#17455a]" : "text-[#8fa2b8]"}>{counts[key]}</span>
            </button>
          ))}
        </div>
      </header>

      {visibleRounds.length ? (
        <div className="space-y-2 py-2 sm:space-y-4 sm:p-5">
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
          <p className="mt-3 font-black text-[#fafcff]">{query.trim() ? `No matches found for “${query.trim()}”.` : `No ${filter} matches right now.`}</p>
          <button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="mt-3 text-sm font-black text-[#52d3ee]">Show every match</button>
        </div>
      )}
    </section>
  );
}
