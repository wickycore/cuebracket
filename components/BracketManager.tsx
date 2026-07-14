"use client";

import { useMemo, useState } from "react";
import { DoubleEliminationManager } from "@/components/DoubleEliminationManager";
import { buildSingleEliminationBracket, recomputeSingleEliminationBracket } from "@/lib/bracket/singleElimination";
import {
  BracketMatch,
  BracketRound,
  Tournament,
  SingleEliminationBracket,
  TournamentBracket,
  updateTournament,
} from "@/lib/tournaments";

interface BracketManagerProps {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

function roundName(matchCount: number) {
  if (matchCount === 1) return "Final";
  if (matchCount === 2) return "Semi Final";
  if (matchCount === 4) return "Quarter Final";
  return `Round of ${matchCount * 2}`;
}

function makeMatch(round: number, position: number, player1: string | null, player2: string | null): BracketMatch {
  return {
    id: `r${round}-m${position}`,
    round,
    position,
    player1,
    player2,
    score1: null,
    score2: null,
    winner: null,
    completed: false,
  };
}

function autoResolveMatch(match: BracketMatch): BracketMatch {
  if (match.player1 && !match.player2) {
    return { ...match, winner: match.player1, completed: true, score1: null, score2: null };
  }
  if (!match.player1 && match.player2) {
    return { ...match, winner: match.player2, completed: true, score1: null, score2: null };
  }
  if (!match.player1 && !match.player2) {
    return { ...match, winner: null, completed: false, score1: null, score2: null };
  }
  return match;
}

function buildSingleBracket(tournament: Tournament): SingleEliminationBracket {
  const slots: Array<string | null> = Array.from({ length: tournament.bracketSize }, (_, index) =>
    tournament.players[index] ?? null,
  );

  const rounds: BracketRound[] = [];
  const firstMatches: BracketMatch[] = [];

  for (let index = 0; index < slots.length; index += 2) {
    firstMatches.push(autoResolveMatch(makeMatch(1, index / 2, slots[index], slots[index + 1])));
  }

  rounds.push({ round: 1, name: roundName(firstMatches.length), matches: firstMatches });

  let matchCount = firstMatches.length / 2;
  let round = 2;
  while (matchCount >= 1) {
    rounds.push({
      round,
      name: roundName(matchCount),
      matches: Array.from({ length: matchCount }, (_, position) => makeMatch(round, position, null, null)),
    });
    matchCount /= 2;
    round += 1;
  }

  return recomputeBracket({ type: "single", rounds, generatedAt: new Date().toISOString(), champion: null });
}

function recomputeBracket(bracket: SingleEliminationBracket): SingleEliminationBracket {
  const rounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1].matches;
    const current = rounds[roundIndex].matches;

    current.forEach((match, position) => {
      const nextPlayer1 = previous[position * 2]?.winner ?? null;
      const nextPlayer2 = previous[position * 2 + 1]?.winner ?? null;
      const participantsChanged = match.player1 !== nextPlayer1 || match.player2 !== nextPlayer2;

      match.player1 = nextPlayer1;
      match.player2 = nextPlayer2;

      if (participantsChanged) {
        match.score1 = null;
        match.score2 = null;
        match.winner = null;
        match.completed = false;
      }

      Object.assign(match, autoResolveMatch(match));
    });
  }

  const finalMatch = rounds.at(-1)?.matches[0];
  return {
    ...bracket,
    rounds,
    champion: finalMatch?.completed ? finalMatch.winner : null,
  };
}

export function BracketManager({ tournament, onTournamentChange }: BracketManagerProps) {
  const [message, setMessage] = useState("");
  const [draftScores, setDraftScores] = useState<Record<string, { score1: string; score2: string }>>({});

  if (tournament.format === "double") {
    return <DoubleEliminationManager tournament={tournament} onTournamentChange={onTournamentChange} />;
  }

  const bracket = tournament.bracket?.type === "single" ? tournament.bracket : undefined;
  const minimumPlayers = 2;
  const canGenerate = tournament.players.length >= minimumPlayers;

  const playedMatches = useMemo(() => {
    if (!bracket) return 0;
    return bracket.rounds.flatMap((round) => round.matches).filter((match) => match.completed && match.player1 && match.player2).length;
  }, [bracket]);

  function saveBracket(nextBracket: TournamentBracket | undefined) {
    const updated = updateTournament(tournament.id, { bracket: nextBracket });
    if (updated) onTournamentChange(updated);
  }

  function generateBracket() {
    setMessage("");
    if (tournament.players.length < minimumPlayers) {
      setMessage("Add at least two players before generating the bracket.");
      return;
    }
    saveBracket(buildSingleEliminationBracket(tournament.players, tournament.bracketSize));
  }

  function resetBracket() {
    if (!window.confirm("Reset this bracket and remove all entered scores?")) return;
    setDraftScores({});
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

    if (!Number.isInteger(score1) || !Number.isInteger(score2) || score1 < 0 || score2 < 0) {
      setMessage("Scores must be whole numbers of zero or more.");
      return;
    }
    if (score1 === score2) {
      setMessage("A match cannot finish as a draw.");
      return;
    }

    const rounds = bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((item) => ({ ...item })),
    }));
    const target = rounds[match.round - 1].matches[match.position];
    target.score1 = score1;
    target.score2 = score2;
    target.winner = score1 > score2 ? target.player1 : target.player2;
    target.completed = true;

    setMessage("");
    saveBracket(recomputeSingleEliminationBracket({ ...bracket, rounds }));
  }

  function clearResult(match: BracketMatch) {
    if (!bracket) return;
    const rounds = bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((item) => ({ ...item })),
    }));
    const target = rounds[match.round - 1].matches[match.position];
    target.score1 = null;
    target.score2 = null;
    target.winner = null;
    target.completed = false;
    setDraftScores((current) => ({ ...current, [match.id]: { score1: "", score2: "" } }));
    saveBracket(recomputeSingleEliminationBracket({ ...bracket, rounds }));
  }

  if (!bracket) {
    return (
      <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center">
        <div className="text-4xl">🧩</div>
        <h2 className="mt-4 text-2xl font-black">Generate the tournament bracket</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-400">
          The current player order becomes the draw order. Empty bracket slots are treated as automatic BYEs.
        </p>
        {message ? <p className="mt-4 text-sm font-bold text-amber-300">{message}</p> : null}
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

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">Single elimination</p>
          <h2 className="mt-2 text-2xl font-black">Tournament bracket</h2>
          <p className="mt-2 text-sm text-slate-400">
            {playedMatches} completed matches · {bracket.champion ? `Champion: ${bracket.champion}` : "Tournament in progress"}
          </p>
        </div>
        <button
          type="button"
          onClick={resetBracket}
          className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
        >
          Reset bracket
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
          <p className="mt-3 text-sm font-black uppercase tracking-[0.25em] text-amber-300">Champion</p>
          <h3 className="mt-2 text-4xl font-black text-white">{bracket.champion}</h3>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-[2rem] border border-white/10 bg-slate-900/50 p-5 sm:p-7">
        <div className="flex min-w-max items-start gap-14 pb-4">
          {bracket.rounds.map((round, roundIndex) => (
            <div key={round.round} className="w-72 shrink-0">
              <p className="mb-5 text-sm font-black uppercase tracking-[0.18em] text-slate-400">{round.name}</p>
              <div
                className="flex flex-col"
                style={{
                  gap: `${24 + (Math.pow(2, roundIndex) - 1) * 116}px`,
                  paddingTop: `${(Math.pow(2, roundIndex) - 1) * 58}px`,
                }}
              >
                {round.matches.map((match) => {
                  const draft = draftScores[match.id] ?? {
                    score1: match.score1?.toString() ?? "",
                    score2: match.score2?.toString() ?? "",
                  };
                  const playable = Boolean(match.player1 && match.player2);

                  return (
                    <article
                      key={match.id}
                      className={`relative overflow-visible rounded-2xl border bg-slate-950/80 shadow-xl ${
                        match.completed ? "border-emerald-400/35" : "border-white/10"
                      }`}
                    >
                      {roundIndex < bracket.rounds.length - 1 ? (
                        <span className="absolute left-full top-1/2 h-px w-14 bg-cyan-400/35" />
                      ) : null}
                      {[match.player1, match.player2].map((player, playerIndex) => {
                        const isWinner = Boolean(match.completed && player && match.winner === player);
                        const scoreKey = playerIndex === 0 ? "score1" : "score2";
                        return (
                          <div
                            key={playerIndex}
                            className={`flex items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 ${isWinner ? "bg-emerald-400/10" : ""}`}
                          >
                            <span className={`min-w-0 flex-1 truncate font-bold ${isWinner ? "text-emerald-300" : player ? "text-white" : "text-slate-600"}`}>
                              {player ?? "BYE"}
                            </span>
                            {playable ? (
                              <input
                                inputMode="numeric"
                                value={draft[scoreKey]}
                                onChange={(event) =>
                                  setDraftScores((current) => ({
                                    ...current,
                                    [match.id]: { ...draft, [scoreKey]: event.target.value },
                                  }))
                                }
                                className="h-9 w-14 rounded-lg border border-white/10 bg-slate-900 px-2 text-center font-black text-white outline-none focus:border-cyan-400/50"
                                aria-label={`${player} score`}
                              />
                            ) : (
                              <span className="text-xs font-bold text-slate-600">—</span>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                        <span className="min-w-0 truncate text-xs font-bold text-slate-500">
                          {match.completed ? `Winner: ${match.winner}` : playable ? `Race to ${tournament.raceTo}` : "Waiting"}
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
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
