"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import {
  BracketConnections,
  useBracketMatchRefs,
} from "@/components/BracketConnections";
import { BracketViewport } from "@/components/BracketViewport";
import { DoubleEliminationManager } from "@/components/DoubleEliminationManager";
import {
  buildSingleEliminationBracket,
  countSingleEliminationPlayedMatches,
  isValidRaceResult,
  recomputeSingleEliminationBracket,
  updateSingleEliminationMatch,
} from "@/lib/bracket/singleElimination";
import type {
  BracketMatch,
  Tournament,
  TournamentBracket,
} from "@/lib/tournaments";
import { updateTournament } from "@/lib/tournaments";

interface BracketManagerProps {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

type ScoreDraft = { score1: string; score2: string };

function isAutomaticAdvance(match: BracketMatch) {
  return match.completed && Boolean(match.player1) !== Boolean(match.player2);
}

function isInactiveSlot(match: BracketMatch) {
  return match.completed && !match.player1 && !match.player2;
}

function bracketFingerprint(bracket: TournamentBracket | undefined) {
  return JSON.stringify(bracket ?? null);
}

export function BracketManager(props: BracketManagerProps) {
  if (props.tournament.format === "double") {
    return <DoubleEliminationManager {...props} />;
  }

  return <SingleEliminationManager {...props} />;
}

function SingleEliminationManager({
  tournament,
  onTournamentChange,
}: BracketManagerProps) {
  const [message, setMessage] = useState("");
  const [draftScores, setDraftScores] = useState<Record<string, ScoreDraft>>(
    {},
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  const { matchRefs, registerMatch } = useBracketMatchRefs();

  const bracket =
    tournament.bracket?.type === "single" ? tournament.bracket : undefined;
  const canGenerate = tournament.players.length >= 2;
  const playedMatches = useMemo(
    () => (bracket ? countSingleEliminationPlayedMatches(bracket) : 0),
    [bracket],
  );
  const automaticByes = useMemo(
    () =>
      bracket
        ? bracket.rounds
            .flatMap((round) => round.matches)
            .filter(isAutomaticAdvance).length
        : 0,
    [bracket],
  );

  // Repair tournaments saved by older engines. This clears premature
  // champions/results, restores feeder sources and synchronizes status.
  useEffect(() => {
    if (!bracket) return;
    const repaired = recomputeSingleEliminationBracket(bracket);
    const repairedStatus = repaired.champion
      ? "completed"
      : tournament.status === "completed"
        ? "live"
        : tournament.status;

    if (
      bracketFingerprint(repaired) === bracketFingerprint(bracket) &&
      repairedStatus === tournament.status
    ) {
      return;
    }

    const updated = updateTournament(tournament.id, {
      bracket: repaired,
      status: repairedStatus,
    });
    if (updated) onTournamentChange(updated);
  }, [bracket, onTournamentChange, tournament.id, tournament.status]);

  function saveBracket(nextBracket: TournamentBracket | undefined) {
    let status = tournament.status;

    if (!nextBracket) {
      status = "draft";
    } else if (nextBracket.champion) {
      status = "completed";
    } else if (
      nextBracket.type === "single" &&
      countSingleEliminationPlayedMatches(nextBracket) > 0
    ) {
      status = "live";
    } else if (tournament.status === "completed") {
      status = "live";
    }

    const updated = updateTournament(tournament.id, {
      bracket: nextBracket,
      status,
    });
    if (updated) onTournamentChange(updated);
  }

  function generateBracket() {
    setMessage("");
    if (!canGenerate) {
      setMessage("Add at least two players before generating the bracket.");
      return;
    }

    saveBracket(
      buildSingleEliminationBracket(
        tournament.players,
        tournament.bracketSize,
      ),
    );
  }

  function resetBracket() {
    if (
      !window.confirm(
        "Reset this competition and remove every entered single-elimination result?",
      )
    ) {
      return;
    }
    setDraftScores({});
    setMessage("");
    saveBracket(undefined);
  }

  function saveResult(match: BracketMatch) {
    if (!bracket || !match.player1 || !match.player2) return;

    const draft = draftScores[match.id] ?? {
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

    const next = updateSingleEliminationMatch(
      bracket,
      match.id,
      (target) => {
        target.score1 = score1;
        target.score2 = score2;
        target.winner = score1 > score2 ? target.player1 : target.player2;
        target.completed = true;
        target.status = "finished";
        target.endedAt = target.endedAt ?? new Date().toISOString();
      },
    );

    setMessage("");
    saveBracket(next);
  }

  function clearResult(match: BracketMatch) {
    if (!bracket) return;

    const next = updateSingleEliminationMatch(
      bracket,
      match.id,
      (target) => {
        target.score1 = null;
        target.score2 = null;
        target.winner = null;
        target.completed = false;
        target.status = "pending";
        target.startedAt = null;
        target.endedAt = null;
        target.scoreHistory = [];
      },
    );

    setDraftScores((current) => ({
      ...current,
      [match.id]: { score1: "", score2: "" },
    }));
    setMessage("");
    saveBracket(next);
  }

  if (!bracket) {
    return (
      <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center">
        <div className="text-4xl">🎱</div>
        <h2 className="mt-4 text-2xl font-black">
          Generate the tournament bracket
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-400">
          The player order becomes the draw order. Genuine empty first-round
          places are distributed as automatic BYEs.
        </p>
        {message ? (
          <p className="mt-4 text-sm font-bold text-amber-300">{message}</p>
        ) : null}
        <button
          type="button"
          onClick={generateBracket}
          disabled={!canGenerate}
          className="mt-7 rounded-2xl bg-cyan-400 px-6 py-3.5 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generate bracket
        </button>
      </section>
    );
  }

  const maxMatches = Math.max(
    1,
    ...bracket.rounds.map((round) => round.matches.length),
  );

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">
            Single elimination
          </p>
          <h2 className="mt-2 text-2xl font-black">Tournament bracket</h2>
          <p className="mt-2 text-sm text-slate-400">
            {playedMatches} played {playedMatches === 1 ? "match" : "matches"}
            {automaticByes ? ` · ${automaticByes} automatic BYEs` : ""} ·{" "}
            {bracket.champion
              ? `Champion: ${bracket.champion}`
              : "Tournament in progress"}
          </p>
        </div>
        <button
          type="button"
          onClick={resetBracket}
          className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
        >
          Reset competition
        </button>
      </div>

      {message ? (
        <p className="mt-4 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200 ring-1 ring-amber-400/20">
          {message}
        </p>
      ) : null}

      {bracket.champion ? (
        <div className="mt-5 rounded-[2rem] border border-amber-300/20 bg-gradient-to-r from-amber-300/10 to-cyan-300/10 p-7 text-center">
          <div className="text-5xl">🏆</div>
          <p className="mt-3 text-sm font-black uppercase tracking-[0.25em] text-amber-300">
            Tournament champion
          </p>
          <h3 className="mt-2 text-4xl font-black text-white">
            {bracket.champion}
          </h3>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/50">
        <BracketViewport label="Single elimination">
          <div
            ref={contentRef}
            className="relative flex min-w-max snap-x snap-mandatory items-start gap-14 pb-5 pr-12"
          >
            <BracketConnections
              rounds={bracket.rounds}
              containerRef={contentRef}
              matchRefs={matchRefs}
              tone="cyan"
            />

            {bracket.rounds.map((round) => {
              const ratio = Math.max(
                1,
                Math.floor(maxMatches / Math.max(1, round.matches.length)),
              );
              const topPadding =
                ratio > 1 ? Math.min(110, (ratio - 1) * 31) : 0;
              const gap = ratio > 1 ? Math.min(136, ratio * 34) : 18;

              return (
                <div
                  key={round.round}
                  className="w-72 shrink-0 snap-start"
                >
                  <p className="mb-4 text-[11px] font-black uppercase tracking-[0.17em] text-slate-500">
                    {round.name}
                  </p>
                  <div style={{ paddingTop: topPadding, display: "grid", gap }}>
                    {round.matches.map((match, matchIndex) => {
                      const draft = draftScores[match.id] ?? {
                        score1: match.score1?.toString() ?? "",
                        score2: match.score2?.toString() ?? "",
                      };
                      const playable = Boolean(match.player1 && match.player2);
                      const automaticAdvance = isAutomaticAdvance(match);
                      const inactive = isInactiveSlot(match);
                      const waiting =
                        !match.completed && !playable &&
                        Boolean(match.player1 || match.player2);

                      return (
                        <div
                          key={match.id}
                          ref={(node: HTMLDivElement | null) => registerMatch(match.id, node)}
                          className={`relative overflow-hidden rounded-2xl border bg-slate-950/90 shadow-xl ${
                            inactive
                              ? "border-white/5 opacity-45"
                              : match.completed
                                ? "border-emerald-400/35"
                                : "border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <span>Match {matchIndex + 1}</span>
                            <span>
                              {inactive
                                ? "Inactive"
                                : automaticAdvance
                                  ? "BYE"
                                  : match.completed
                                    ? "Finished"
                                    : waiting
                                      ? "Waiting"
                                      : "Pending"}
                            </span>
                          </div>

                          {inactive ? (
                            <div className="px-4 py-5 text-center text-xs font-bold text-slate-600">
                              Empty bracket branch
                            </div>
                          ) : automaticAdvance ? (
                            <div className="px-4 py-5">
                              <p className="font-black text-violet-200">
                                {match.player1 ?? match.player2}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Advances automatically — no played match.
                              </p>
                            </div>
                          ) : (
                            <>
                              {[match.player1, match.player2].map(
                                (player, playerIndex) => {
                                  const isWinner = Boolean(
                                    match.completed &&
                                      player &&
                                      match.winner === player,
                                  );
                                  const scoreKey =
                                    playerIndex === 0 ? "score1" : "score2";

                                  return (
                                    <div
                                      key={playerIndex}
                                      className={`flex items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 ${
                                        isWinner ? "bg-emerald-400/10" : ""
                                      }`}
                                    >
                                      <span
                                        className={`min-w-0 flex-1 truncate font-bold ${
                                          isWinner
                                            ? "text-emerald-300"
                                            : player
                                              ? "text-white"
                                              : "text-slate-600"
                                        }`}
                                      >
                                        {player ?? "TBD"}
                                      </span>
                                      {playable ? (
                                        <input
                                          inputMode="numeric"
                                          min={0}
                                          max={tournament.raceTo}
                                          value={draft[scoreKey]}
                                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                            setDraftScores((current) => ({
                                              ...current,
                                              [match.id]: {
                                                ...draft,
                                                [scoreKey]: event.target.value,
                                              },
                                            }))
                                          }
                                          className="h-10 w-14 rounded-lg border border-white/10 bg-slate-900 px-2 text-center font-black text-white outline-none focus:border-cyan-400/50"
                                          aria-label={`${player} score`}
                                        />
                                      ) : (
                                        <span className="text-xs font-bold text-slate-600">
                                          —
                                        </span>
                                      )}
                                    </div>
                                  );
                                },
                              )}

                              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                                <span className="min-w-0 truncate text-xs font-bold text-slate-500">
                                  {match.completed
                                    ? `Winner: ${match.winner}`
                                    : playable
                                      ? `Race to ${tournament.raceTo}`
                                      : "Waiting for the other feeder match"}
                                </span>
                                {playable ? (
                                  <div className="flex gap-1.5">
                                    {match.completed ? (
                                      <button
                                        type="button"
                                        onClick={() => clearResult(match)}
                                        className="rounded-lg px-2 py-1 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white"
                                      >
                                        Undo
                                      </button>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => saveResult(match)}
                                      className="rounded-lg bg-cyan-400 px-2.5 py-1 text-xs font-black text-slate-950 hover:bg-cyan-300"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </>
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
      </div>
    </section>
  );
}
