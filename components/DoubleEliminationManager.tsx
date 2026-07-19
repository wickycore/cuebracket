"use client";

import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  BracketMatch,
  BracketRound,
  DoubleEliminationBracket,
  Tournament,
} from "@/lib/tournaments";
import {
  formatDuration,
  getTournamentChampionDescription,
  updateTournament,
} from "@/lib/tournaments";
import {
  buildDoubleEliminationBracket,
  fillDoubleEliminationByeSlot,
  getDoubleEliminationLateEntrySlots,
  recomputeDoubleEliminationBracket,
  updateDoubleMatch,
} from "@/lib/bracket/doubleElimination";
import { isValidRaceResult } from "@/lib/bracket/singleElimination";
import {
  BracketConnections,
  useBracketMatchRefs,
  type ConnectorTone,
} from "@/components/BracketConnections";
import { BracketViewport } from "@/components/BracketViewport";
import { ChampionCelebration } from "@/components/ChampionCelebration";
import { LateEntryPanel } from "@/components/LateEntryPanel";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

type BracketTone = "winners" | "losers" | "final";
type Draft = { score1: string; score2: string };

const connectorTone: Record<BracketTone, ConnectorTone> = {
  winners: "cyan",
  losers: "rose",
  final: "violet",
};

const toneStyles: Record<
  BracketTone,
  { title: string; active: string; panel: string }
> = {
  winners: {
    title: "text-cyan-300",
    active: "border-cyan-400/40",
    panel: "from-cyan-400/[0.08] via-slate-950/90 to-slate-950/95",
  },
  losers: {
    title: "text-rose-300",
    active: "border-rose-400/40",
    panel: "from-rose-400/[0.07] via-slate-950/90 to-slate-950/95",
  },
  final: {
    title: "text-violet-300",
    active: "border-violet-400/40",
    panel: "from-violet-400/[0.09] via-slate-950/90 to-slate-950/95",
  },
};

function isAutomaticAdvance(match: BracketMatch) {
  return match.completed && Boolean(match.player1) !== Boolean(match.player2);
}

function isInactive(match: BracketMatch) {
  return match.completed && !match.player1 && !match.player2;
}

function MatchCard({
  match,
  raceTo,
  draft,
  setDraft,
  save,
  undo,
  tone,
}: {
  match: BracketMatch;
  raceTo: number;
  draft: Draft;
  setDraft: (value: Draft) => void;
  save: () => void;
  undo: () => void;
  tone: BracketTone;
}) {
  const playable = Boolean(match.player1 && match.player2);
  const automaticAdvance = isAutomaticAdvance(match);
  const inactive = isInactive(match);
  const advancingPlayer = match.player1 ?? match.player2 ?? match.winner;
  const styles = toneStyles[tone];
  const isLive = match.status === "live";
  const duration = match.startedAt
    ? formatDuration(
        new Date(match.endedAt ?? Date.now()).getTime() -
          new Date(match.startedAt).getTime(),
      )
    : null;

  if (inactive) {
    return (
      <article className="rounded-2xl border border-white/5 bg-slate-950/70 p-4 opacity-40">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
          Inactive branch
        </span>
        <p className="mt-2 text-sm font-bold text-slate-600">No players</p>
      </article>
    );
  }

  if (automaticAdvance) {
    return (
      <article
        className={`rounded-2xl border ${styles.active} bg-slate-950/95 p-4 shadow-xl`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
            Automatic BYE
          </span>
          <span className="text-xs font-black text-emerald-300">Advanced</span>
        </div>
        <strong className="mt-3 block text-base text-white">
          {advancingPlayer}
        </strong>
        <span className="mt-1 block text-xs text-slate-500">No opponent</span>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {advancingPlayer} advances automatically. This does not count as a
          played match.
        </p>
      </article>
    );
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-slate-950/95 shadow-xl ${
        match.completed ? styles.active : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
        <span>
          {match.tableNumber ? `Table ${match.tableNumber}` : `Match ${match.position + 1}`}
        </span>
        <span>
          {match.completed
            ? "Finished"
            : isLive
              ? "● Live"
              : playable
                ? "Ready"
                : "Waiting"}
        </span>
      </div>

      <div className="divide-y divide-white/5">
        {[match.player1, match.player2].map((player, index) => {
          const isWinner = Boolean(
            match.completed && player && match.winner === player,
          );
          const score = index === 0 ? draft.score1 : draft.score2;
          return (
            <div
              key={`${match.id}-${index}`}
              className={`flex min-h-12 items-center justify-between gap-3 px-3 py-2 ${
                isWinner ? "bg-emerald-400/10" : ""
              }`}
            >
              <span
                className={`min-w-0 truncate text-sm font-bold ${
                  isWinner ? "text-emerald-200" : "text-slate-200"
                }`}
              >
                {player ?? "TBD"}
              </span>
              {playable ? (
                <input
                  inputMode="numeric"
                  value={score}
                  onChange={(event) =>
                    setDraft(
                      index === 0
                        ? { ...draft, score1: event.target.value }
                        : { ...draft, score2: event.target.value },
                    )
                  }
                  aria-label={`Score for ${player ?? `player ${index + 1}`}`}
                  className="h-9 w-12 rounded-lg border border-white/10 bg-slate-900 px-1 text-center text-sm font-black text-white outline-none focus:border-cyan-400/60"
                />
              ) : (
                <span className="text-slate-600">—</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="text-[11px] font-bold text-slate-500">
          {match.completed
            ? `Winner: ${match.winner}${duration ? ` · ${duration}` : ""}`
            : playable
              ? `Race to ${raceTo}${duration ? ` · ${duration}` : ""}`
              : "Waiting for players"}
        </span>
        {playable ? (
          <div className="flex items-center gap-1">
            {match.completed ? (
              <button
                type="button"
                onClick={undo}
                className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Undo
              </button>
            ) : null}
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-cyan-400 px-2.5 py-1 text-xs font-black text-slate-950 hover:bg-cyan-300"
            >
              Save
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function BracketRoundColumn({
  round,
  tournament,
  drafts,
  setDrafts,
  saveResult,
  clearResult,
  tone,
  maxMatches,
  registerMatch,
}: {
  round: BracketRound;
  tournament: Tournament;
  drafts: Record<string, Draft>;
  setDrafts: Dispatch<SetStateAction<Record<string, Draft>>>;
  saveResult: (match: BracketMatch) => void;
  clearResult: (match: BracketMatch) => void;
  tone: BracketTone;
  maxMatches: number;
  registerMatch: (matchId: string, node: HTMLDivElement | null) => void;
}) {
  const ratio = Math.max(
    1,
    Math.floor(maxMatches / Math.max(1, round.matches.length)),
  );
  const topPadding = ratio > 1 ? Math.min(96, (ratio - 1) * 28) : 0;
  const gap = ratio > 1 ? Math.min(120, ratio * 30) : 18;

  return (
    <section className="w-64 shrink-0">
      <h4
        className={`mb-4 text-center text-sm font-black uppercase tracking-[0.18em] ${toneStyles[tone].title}`}
      >
        {round.name}
      </h4>
      <div className="grid" style={{ paddingTop: topPadding, gap }}>
        {round.matches.map((match) => {
          const draft = drafts[match.id] ?? {
            score1: match.score1?.toString() ?? "",
            score2: match.score2?.toString() ?? "",
          };
          return (
            <div
              key={match.id}
              ref={(node) => registerMatch(match.id, node)}
              className="relative z-10"
            >
              <MatchCard
                match={match}
                raceTo={tournament.raceTo}
                draft={draft}
                setDraft={(value) =>
                  setDrafts((current) => ({ ...current, [match.id]: value }))
                }
                save={() => saveResult(match)}
                undo={() => clearResult(match)}
                tone={tone}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BracketSection({
  title,
  subtitle,
  rounds,
  tournament,
  drafts,
  setDrafts,
  saveResult,
  clearResult,
  tone,
}: {
  title: string;
  subtitle: string;
  rounds: BracketRound[];
  tournament: Tournament;
  drafts: Record<string, Draft>;
  setDrafts: Dispatch<SetStateAction<Record<string, Draft>>>;
  saveResult: (match: BracketMatch) => void;
  clearResult: (match: BracketMatch) => void;
  tone: BracketTone;
}) {
  const styles = toneStyles[tone];
  const maxMatches = Math.max(
    1,
    ...rounds.map((round) => round.matches.length),
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const { matchRefs, registerMatch } = useBracketMatchRefs();

  return (
    <section
      className={`rounded-3xl border border-white/10 bg-gradient-to-br ${styles.panel} p-4 shadow-2xl sm:p-5`}
    >
      <h3 className={`text-xl font-black ${styles.title}`}>{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-4">
        <BracketViewport label={`${title} bracket`}>
          <div ref={contentRef} className="relative min-w-max p-4">
            <BracketConnections
              rounds={rounds}
              containerRef={contentRef}
              matchRefs={matchRefs}
              tone={connectorTone[tone]}
            />
            <div className="relative z-10 flex items-start gap-8">
              {rounds.map((round) => (
                <BracketRoundColumn
                  key={`${tone}-${round.round}-${round.name}`}
                  round={round}
                  tournament={tournament}
                  drafts={drafts}
                  setDrafts={setDrafts}
                  saveResult={saveResult}
                  clearResult={clearResult}
                  tone={tone}
                  maxMatches={maxMatches}
                  registerMatch={registerMatch}
                />
              ))}
            </div>
          </div>
        </BracketViewport>
      </div>
    </section>
  );
}

export function DoubleEliminationManager({
  tournament,
  onTournamentChange,
}: Props) {
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const bracket =
    tournament.bracket?.type === "double" ? tournament.bracket : undefined;

  const completed = useMemo(() => {
    if (!bracket) return 0;
    return [...bracket.winners, ...bracket.losers, ...bracket.grandFinal]
      .flatMap((round) => round.matches)
      .filter((match) => match.completed && match.player1 && match.player2)
      .length;
  }, [bracket]);

  const { totalPlayable, automaticByes } = useMemo(() => {
    if (!bracket) return { totalPlayable: 0, automaticByes: 0 };
    const structuralMatches = [
      ...bracket.winners,
      ...bracket.losers,
      ...bracket.grandFinal.filter(
        (round) => round.round === 1 || bracket.resetRequired,
      ),
    ].flatMap((round) => round.matches);
    const automaticAdvances = structuralMatches.filter(
      (match) => match.completed && !(match.player1 && match.player2),
    ).length;
    const byes = structuralMatches.filter(isAutomaticAdvance).length;
    return {
      totalPlayable: Math.max(
        completed,
        structuralMatches.length - automaticAdvances,
      ),
      automaticByes: byes,
    };
  }, [bracket, completed]);

  const lateEntrySlots = useMemo(
    () => (bracket ? getDoubleEliminationLateEntrySlots(bracket) : []),
    [bracket],
  );

  const progress = bracket?.champion
    ? 100
    : totalPlayable
      ? Math.min(100, Math.round((completed / totalPlayable) * 100))
      : 0;

  function saveBracket(next: DoubleEliminationBracket | undefined) {
    const updated = updateTournament(tournament.id, {
      bracket: next,
      status: next?.champion ? "completed" : next ? "live" : "draft",
    });
    if (updated) onTournamentChange(updated);
  }

  function generate() {
    if (tournament.players.length < 2) {
      setMessage("Add at least two players before generating the bracket.");
      return;
    }
    setMessage("");
    saveBracket(buildDoubleEliminationBracket(tournament));
  }

  function saveResult(match: BracketMatch) {
    if (!bracket || !match.player1 || !match.player2) return;
    const draft = drafts[match.id] ?? {
      score1: match.score1?.toString() ?? "",
      score2: match.score2?.toString() ?? "",
    };
    const score1 = Number(draft.score1);
    const score2 = Number(draft.score2);

    if (!isValidRaceResult(score1, score2, tournament.raceTo)) {
      setMessage(
        `A completed race-to-${tournament.raceTo} result must have exactly one player on ${tournament.raceTo}, with the opponent below ${tournament.raceTo}.`,
      );
      return;
    }

    setMessage("");
    saveBracket(
      updateDoubleMatch(bracket, match.id, (target) => {
        target.score1 = score1;
        target.score2 = score2;
        target.winner = score1 > score2 ? target.player1 : target.player2;
        target.completed = true;
        target.status = "finished";
        target.endedAt = new Date().toISOString();
      }),
    );
  }

  function clearResult(match: BracketMatch) {
    if (!bracket) return;
    setDrafts((current) => ({
      ...current,
      [match.id]: { score1: "", score2: "" },
    }));
    saveBracket(
      updateDoubleMatch(bracket, match.id, (target) => {
        target.score1 = null;
        target.score2 = null;
        target.winner = null;
        target.completed = false;
        target.status = "pending";
        target.startedAt = null;
        target.endedAt = null;
        target.scoreHistory = [];
      }),
    );
  }

  function addLatePlayer(playerName: string, matchId: string) {
    if (!bracket) return "The bracket has not been generated.";
    if (tournament.players.length >= tournament.bracketSize) {
      return `This event is full at ${tournament.bracketSize} players.`;
    }
    if (
      tournament.players.some(
        (player) => player.toLowerCase() === playerName.toLowerCase(),
      )
    ) {
      return "That player is already in the tournament.";
    }

    const result = fillDoubleEliminationByeSlot(
      bracket,
      matchId,
      playerName,
    );
    if (!result.ok) return result.reason;

    const updated = updateTournament(tournament.id, {
      players: [...tournament.players, playerName],
      bracket: result.bracket,
      status: tournament.status === "completed" ? "live" : tournament.status,
    });
    if (!updated) return "The late player could not be saved.";

    setDrafts({});
    setMessage("");
    onTournamentChange(updated);
    return null;
  }

  if (!bracket) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <span className="text-3xl">♻️</span>
        <h2 className="mt-3 text-2xl font-black text-white">
          Generate the double-elimination bracket
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Each player is eliminated only after a second loss. BYEs advance
          automatically and may be filled by a late entry while their affected
          matches remain untouched.
        </p>
        {message ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">
            {message}
          </p>
        ) : null}
        <button
          type="button"
          onClick={generate}
          className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300"
        >
          Generate double bracket
        </button>
      </section>
    );
  }

  const grandFinalRounds = bracket.grandFinal.filter(
    (round) => round.round === 1 || bracket.resetRequired,
  );

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="text-xs font-black uppercase tracking-[0.24em] text-violet-300">
              Double elimination
            </span>
            <h2 className="mt-2 text-2xl font-black text-white">
              Separated winners and losers brackets
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {completed} played match{completed === 1 ? "" : "es"}
              {automaticByes
                ? ` · ${automaticByes} automatic BYE${automaticByes === 1 ? "" : "s"}`
                : ""}
              {" · "}
              {bracket.champion
                ? `Champion: ${bracket.champion}`
                : bracket.resetRequired
                  ? "Bracket reset required"
                  : "Tournament in progress"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-bold text-slate-300">
              <input
                type="checkbox"
                checked={bracket.bracketResetEnabled}
                onChange={(event) =>
                  saveBracket(
                    recomputeDoubleEliminationBracket({
                      ...bracket,
                      bracketResetEnabled: event.target.checked,
                    }),
                  )
                }
              />
              Grand-final reset
            </label>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm("Reset this competition and remove all scores?")
                ) {
                  saveBracket(undefined);
                }
              }}
              className="min-h-11 rounded-xl border border-rose-400/20 px-4 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
            >
              Reset competition
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between text-sm">
            <strong className="text-white">Tournament progress</strong>
            <span className="font-black text-cyan-300">{progress}%</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {completed} of {totalPlayable} played matches completed
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-cyan-400 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">
            {message}
          </p>
        ) : null}

        {bracket.champion ? (
          <div className="mt-5">
            <ChampionCelebration
              champion={bracket.champion}
              description={getTournamentChampionDescription(tournament)}
            />
          </div>
        ) : null}
      </section>

      <LateEntryPanel
        slots={lateEntrySlots}
        remainingCapacity={tournament.bracketSize - tournament.players.length}
        onAdd={addLatePlayer}
      />

      <BracketSection
        title="Winners Bracket"
        subtitle="Players remain here until their first loss."
        rounds={bracket.winners}
        tournament={tournament}
        drafts={drafts}
        setDrafts={setDrafts}
        saveResult={saveResult}
        clearResult={clearResult}
        tone="winners"
      />

      <BracketSection
        title="Losers Bracket"
        subtitle="A second loss eliminates the player from the tournament."
        rounds={bracket.losers}
        tournament={tournament}
        drafts={drafts}
        setDrafts={setDrafts}
        saveResult={saveResult}
        clearResult={clearResult}
        tone="losers"
      />

      <BracketSection
        title="Grand Final"
        subtitle={
          bracket.resetRequired
            ? "The losers-bracket winner forced a bracket-reset match."
            : "The winners-bracket finalist meets the survivor of the losers bracket."
        }
        rounds={grandFinalRounds}
        tournament={tournament}
        drafts={drafts}
        setDrafts={setDrafts}
        saveResult={saveResult}
        clearResult={clearResult}
        tone="final"
      />
    </div>
  );
}
