"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getActiveSpectatorRound,
  getSpectatorMatchState,
  matchesSpectatorPlayer,
  numberBracketMatches,
  spectatorSourceLabel,
  type SpectatorMatchState,
} from "@/lib/bracket/spectator";
import { formatDuration, type BracketMatch, type BracketRound } from "@/lib/tournaments";
import { getMatchRaceTo } from "@/lib/tournament-races";
import {
  normalizeParticipantName,
  participantProfilePath,
  type PublicTournamentParticipant,
} from "@/lib/cloud/public-participants";

const rowAccentStyles: Record<SpectatorMatchState, string> = {
  advanced: "bg-[#9b7bea]",
  finished: "bg-[#39d38f]",
  live: "bg-[#39a8ff]",
  ready: "bg-[#56d6ad]",
  waiting: "bg-[#607d9d]",
};

const detailStatusLabels: Record<SpectatorMatchState, string> = {
  advanced: "Automatic BYE",
  finished: "Finished",
  live: "Live now",
  ready: "Ready",
  waiting: "Not started",
};

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 text-[#4aa8dc] transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m7 4 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Score({ score, live }: { score: number | null; live: boolean }) {
  if (score === null) {
    return <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#315878] text-sm font-bold text-[#96abc0]">−</span>;
  }

  return (
    <span className={`text-base font-black tabular-nums ${live ? "text-[#57e6c1]" : "text-[#dff7ff]"}`}>
      {score}
    </span>
  );
}

function MatchRow({
  match,
  matchNumber,
  matchNumbers,
  raceTo,
  now,
  expanded,
  onToggle,
  onOpenPlayer,
}: {
  match: BracketMatch;
  matchNumber: number;
  matchNumbers: Map<string, number>;
  raceTo: number;
  now: number;
  expanded: boolean;
  onToggle: () => void;
  onOpenPlayer?: (player: string) => void;
}) {
  const state = getSpectatorMatchState(match);
  const matchRaceTo = getMatchRaceTo(match, raceTo);
  const automaticAdvance = state === "advanced";
  const player1 = match.player1 ?? spectatorSourceLabel(match.source1, matchNumbers);
  const player2 = match.player2 ?? spectatorSourceLabel(match.source2, matchNumbers);
  const elapsed = match.startedAt
    ? formatDuration(
        (match.endedAt ? new Date(match.endedAt).getTime() : now) -
          new Date(match.startedAt).getTime(),
      )
    : "";

  if (automaticAdvance) {
    const advancingPlayer = match.player1 ?? match.player2 ?? match.winner ?? "Advanced player";

    return (
      <article className="relative overflow-hidden bg-[#0b192c]">
        <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${rowAccentStyles[state]}`} />
        <div className="flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left">
          <button type="button" onClick={() => onOpenPlayer?.(advancingPlayer)} disabled={!onOpenPlayer} className="group flex min-w-0 flex-1 items-center gap-1 text-left disabled:cursor-default">
            <span className="min-w-0 truncate text-sm font-black text-[#9da9ba] group-enabled:group-hover:text-white">{advancingPlayer}</span>
            {onOpenPlayer ? <span aria-hidden="true" className="shrink-0 text-[#4aa8dc]">›</span> : null}
          </button>
          <span className="shrink-0 text-xs font-bold text-[#a99bd2]">advances · BYE</span>
          <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`Show Match #${matchNumber} details`} className="grid h-9 w-8 shrink-0 place-items-center rounded-lg hover:bg-white/5"><ChevronIcon open={expanded} /></button>
        </div>
        {expanded ? (
          <div className="border-t border-[#203750] bg-[#101f34] px-4 py-2 text-xs font-bold text-[#aebed0]">
            Automatic advance · no match played
          </div>
        ) : null}
      </article>
    );
  }

  const live = state === "live";
  const player1Winner = Boolean(match.completed && match.winner === match.player1);
  const player2Winner = Boolean(match.completed && match.winner === match.player2);

  return (
    <article className={`relative overflow-hidden transition-colors ${live ? "bg-[#102a49]" : "bg-[#0b1c31]"}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${rowAccentStyles[state]}`} />
      <div
        className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_2rem_3.5rem_2rem_minmax(0,1fr)_1rem] items-center gap-1 px-4 py-2 text-left"
      >
        {match.player1 && onOpenPlayer ? <button type="button" onClick={() => onOpenPlayer(match.player1!)} className={`group flex min-w-0 items-center gap-1 truncate text-left text-sm font-black ${player1Winner ? "text-[#8be0b1]" : "text-[#f8fbff]"}`} title={`View ${player1}`}><span className="truncate group-hover:text-[#8cecff]">{player1}</span><span aria-hidden="true" className="shrink-0 text-[#4aa8dc]">›</span></button> : <span className={`min-w-0 truncate text-sm font-black ${player1Winner ? "text-[#8be0b1]" : match.player1 ? "text-[#f8fbff]" : "text-[#94a9be]"}`} title={player1}>{player1}</span>}
        <Score score={match.score1} live={live} />
        <span className="flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#7fa7c5]">M#{matchNumber}</span>
          <span className={`mt-1 text-[11px] font-black ${live ? "text-[#55d7ff]" : "text-[#95acc3]"}`}>
            {live ? "● live" : "vs"}
          </span>
        </span>
        <Score score={match.score2} live={live} />
        {match.player2 && onOpenPlayer ? <button type="button" onClick={() => onOpenPlayer(match.player2!)} className={`group flex min-w-0 items-center justify-end gap-1 truncate text-right text-sm font-black ${player2Winner ? "text-[#8be0b1]" : "text-[#f8fbff]"}`} title={`View ${player2}`}><span className="truncate group-hover:text-[#8cecff]">{player2}</span><span aria-hidden="true" className="shrink-0 text-[#4aa8dc]">›</span></button> : <span className={`min-w-0 truncate text-right text-sm font-black ${player2Winner ? "text-[#8be0b1]" : match.player2 ? "text-[#f8fbff]" : "text-[#94a9be]"}`} title={player2}>{player2}</span>}
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-label={`Show Match #${matchNumber} details`} className="grid h-9 w-7 place-items-center rounded-lg hover:bg-white/5"><ChevronIcon open={expanded} /></button>
      </div>
      {expanded ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#24415e] bg-[#10233b] px-4 py-2 text-xs font-bold text-[#b9c9d9]">
          <span>Match #{matchNumber}</span>
          {match.tableNumber ? <span>Table {match.tableNumber}</span> : null}
          <span>Race to {matchRaceTo}</span>
          <span className={live ? "text-[#63ddff]" : "text-[#a9bdd0]"}>{detailStatusLabels[state]}</span>
          {elapsed ? <span className="flex items-center gap-1"><ClockIcon />{elapsed}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

function RoundPanel({
  round,
  raceTo,
  matchNumbers,
  now,
  query,
  expandedMatchId,
  onToggleMatch,
  onOpenPlayer,
}: {
  round: BracketRound;
  raceTo: number;
  matchNumbers: Map<string, number>;
  now: number;
  query: string;
  expandedMatchId: string;
  onToggleMatch: (matchId: string) => void;
  onOpenPlayer?: (player: string) => void;
}) {
  const [showAutomaticAdvances, setShowAutomaticAdvances] = useState(false);
  const matchingMatches = round.matches.filter((match) => matchesSpectatorPlayer(match, query));
  const automaticAdvances = matchingMatches.filter((match) => getSpectatorMatchState(match) === "advanced");
  const playableMatchesToShow = matchingMatches.filter((match) => getSpectatorMatchState(match) !== "advanced");
  const compactAutomaticAdvances = !query.trim() && automaticAdvances.length >= 2;
  const matches = compactAutomaticAdvances ? playableMatchesToShow : matchingMatches;
  const playableMatches = round.matches.filter((match) => getSpectatorMatchState(match) !== "advanced");
  const completed = playableMatches.filter((match) => getSpectatorMatchState(match) === "finished").length;
  const roundRaceTargets = Array.from(new Set(round.matches.map((match) => getMatchRaceTo(match, raceTo))));
  const roundRaceLabel = roundRaceTargets.length === 1 ? `Race to ${roundRaceTargets[0]}` : "Variable races";

  return (
    <section id={`spectator-round-${round.round}`}>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-y border-[#274866] bg-[#102744]/95 px-4 py-3 backdrop-blur">
        <h3 className="min-w-0 truncate text-base font-black text-[#ffffff]">{round.name}</h3>
        <p className="shrink-0 text-xs font-bold text-[#9bc8e8]">
          {roundRaceLabel} · {completed}/{playableMatches.length} done
        </p>
      </header>
      {matches.length ? (
        <div className="divide-y divide-[#203a54]">
          {compactAutomaticAdvances ? (
            <div className="bg-[#0b192c]">
              <button type="button" onClick={() => setShowAutomaticAdvances((current) => !current)} aria-expanded={showAutomaticAdvances} className="relative flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[.03]">
                <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#9b7bea]" />
                <span className="min-w-0 flex-1 text-sm font-black text-[#d8cff7]">{automaticAdvances.length} players advanced automatically</span>
                <span className="text-xs font-bold text-[#a99bd2]">View players</span>
                <ChevronIcon open={showAutomaticAdvances} />
              </button>
              {showAutomaticAdvances ? (
                <div className="grid grid-cols-2 gap-px border-t border-[#203750] bg-[#203750] sm:grid-cols-3">
                  {automaticAdvances.map((match) => {
                    const player = match.player1 ?? match.player2 ?? match.winner ?? "Advanced player";
                    return <button key={match.id} type="button" onClick={() => onOpenPlayer?.(player)} disabled={!onOpenPlayer} className="flex min-h-10 items-center gap-1 bg-[#101f34] px-4 text-left text-xs font-bold text-[#c4b5fd] hover:bg-[#162944] disabled:cursor-default"><span className="truncate">{player}</span>{onOpenPlayer ? <span aria-hidden="true">›</span> : null}</button>;
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          {matches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              matchNumber={matchNumbers.get(match.id) ?? match.position + 1}
              matchNumbers={matchNumbers}
              raceTo={raceTo}
              now={now}
              expanded={expandedMatchId === match.id}
              onToggle={() => onToggleMatch(match.id)}
              onOpenPlayer={onOpenPlayer}
            />
          ))}
        </div>
      ) : automaticAdvances.length ? (
        <div className="divide-y divide-[#203a54]">
          <button type="button" onClick={() => setShowAutomaticAdvances((current) => !current)} aria-expanded={showAutomaticAdvances} className="relative flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/[.03]"><span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#9b7bea]" /><span className="min-w-0 flex-1 text-sm font-black text-[#d8cff7]">{automaticAdvances.length} players advanced automatically</span><span className="text-xs font-bold text-[#a99bd2]">View players</span><ChevronIcon open={showAutomaticAdvances} /></button>
        </div>
      ) : (
        <div className="px-6 py-14 text-center text-sm font-bold text-[#afc0d2]">
          No matches found for “{query.trim()}” in this round.
        </div>
      )}
    </section>
  );
}

export function BracketMatchList({ rounds, raceTo, tournamentId, participants = [] }: { rounds: BracketRound[]; raceTo: number; tournamentId?: string; participants?: PublicTournamentParticipant[] }) {
  const router = useRouter();
  const activeRound = useMemo(() => getActiveSpectatorRound(rounds), [rounds]);
  const [selectedRoundOverride, setSelectedRoundOverride] = useState<number | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState("");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const allMatches = useMemo(() => rounds.flatMap((round) => round.matches), [rounds]);
  const matchNumbers = useMemo(() => numberBracketMatches(rounds), [rounds]);
  const selectedRound = selectedRoundOverride && rounds.some((round) => round.round === selectedRoundOverride)
    ? selectedRoundOverride
    : activeRound || rounds[0]?.round || 1;
  const selectedRoundData = rounds.find((round) => round.round === selectedRound) ?? rounds[0];
  const hasLiveMatches = allMatches.some((match) => getSpectatorMatchState(match) === "live");
  const participantProfiles = useMemo(() => new Map(
    participants.map((participant) => [normalizeParticipantName(participant.displayName), participant]),
  ), [participants]);

  useEffect(() => {
    if (!hasLiveMatches) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasLiveMatches]);

  function selectRound(roundNumber: number) {
    setSelectedRoundOverride(roundNumber);
    setExpandedMatchId("");
  }

  function openPlayer(playerName: string) {
    if (!tournamentId) return;
    const participant = participantProfiles.get(normalizeParticipantName(playerName));
    router.push(participant
      ? participantProfilePath(participant)
      : `/cloud/live/${encodeURIComponent(tournamentId)}/players/${encodeURIComponent(playerName)}`,
    );
  }

  return (
    <section className="-mx-3 mt-3 overflow-hidden border-y border-[#263c54] bg-[#08172a] sm:mx-0 sm:mt-6 sm:rounded-[1.75rem] sm:border">
      <header className="border-b border-[#263c54] bg-[#0a1b30] px-3 py-4 sm:px-6 sm:py-5">
        <div className="relative">
          <label htmlFor="spectator-player-search" className="sr-only">Find a player</label>
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#7fa7c5]">⌕</span>
          <input
            id="spectator-player-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player — e.g. Wicky"
            className="min-h-11 w-full rounded-xl border border-[#2d5374] bg-[#10233d] pl-10 pr-10 text-base font-bold text-[#f8fbff] outline-none placeholder:text-[#829ab2] focus:border-[#39cbe8] focus:ring-2 focus:ring-[#39cbe8]/20"
          />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear player search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#c7d5e4] hover:bg-[#1b2d45] hover:text-white">×</button> : null}
        </div>

        <p className="sr-only">Jump to round</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Tournament rounds">
          {rounds.map((round) => (
            <button
              key={round.round}
              type="button"
              role="tab"
              aria-selected={round.round === selectedRound}
              onClick={() => selectRound(round.round)}
              className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-black ring-1 transition ${round.round === selectedRound ? "bg-[#125b83] text-[#8cecff] ring-[#36a5d3]" : "bg-[#11243b] text-[#b7c8d9] ring-[#2b4a67] hover:text-white"}`}
            >
              {round.name}
            </button>
          ))}
        </div>
      </header>

      {selectedRoundData ? (
        <RoundPanel
          round={selectedRoundData}
          raceTo={raceTo}
          matchNumbers={matchNumbers}
          now={now}
          query={query}
          expandedMatchId={expandedMatchId}
          onToggleMatch={(matchId) => setExpandedMatchId((current) => current === matchId ? "" : matchId)}
          onOpenPlayer={tournamentId ? openPlayer : undefined}
        />
      ) : (
        <div className="px-6 py-16 text-center font-bold text-[#afc0d2]">No bracket rounds are available yet.</div>
      )}

      <footer className="sticky bottom-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#284966] bg-[#102744]/95 px-4 py-3 text-[11px] font-bold text-[#9fc2df] backdrop-blur">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#607d9d]" />Not started</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#39a8ff]" />Live</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#56d6ad]" />Ready</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#9b7bea]" />BYE</span>
      </footer>
    </section>
  );
}
