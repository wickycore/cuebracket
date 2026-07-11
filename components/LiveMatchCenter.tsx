"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BracketMatch,
  SingleEliminationBracket,
  Tournament,
  TournamentBracket,
  formatDuration,
  getAllMatches,
  updateTournament,
} from "@/lib/tournaments";
import { updateDoubleMatch } from "@/lib/bracket/doubleElimination";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

function autoResolveMatch(match: BracketMatch): BracketMatch {
  if (match.player1 && !match.player2) {
    return {
      ...match,
      winner: match.player1,
      completed: true,
      status: "finished",
    };
  }

  if (!match.player1 && match.player2) {
    return {
      ...match,
      winner: match.player2,
      completed: true,
      status: "finished",
    };
  }

  return match;
}

function cloneSingleBracket(
  bracket: SingleEliminationBracket,
): SingleEliminationBracket {
  return {
    ...bracket,
    rounds: bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({
        ...match,
        scoreHistory: [...(match.scoreHistory ?? [])],
      })),
    })),
  };
}

function recomputeSingleBracket(
  bracket: SingleEliminationBracket,
): SingleEliminationBracket {
  const rounds = cloneSingleBracket(bracket).rounds;

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1].matches;
    const current = rounds[roundIndex].matches;

    current.forEach((match, position) => {
      const player1 = previous[position * 2]?.winner ?? null;
      const player2 = previous[position * 2 + 1]?.winner ?? null;
      const participantsChanged =
        match.player1 !== player1 || match.player2 !== player2;

      match.player1 = player1;
      match.player2 = player2;

      if (participantsChanged) {
        match.score1 = null;
        match.score2 = null;
        match.winner = null;
        match.completed = false;
        match.status = "pending";
        match.startedAt = null;
        match.endedAt = null;
        match.breakPlayer = null;
        match.scoreHistory = [];
      }

      Object.assign(match, autoResolveMatch(match));
    });
  }

  const final = rounds.at(-1)?.matches[0];

  return {
    ...bracket,
    rounds,
    champion: final?.completed ? final.winner : null,
  };
}

export function LiveMatchCenter({
  tournament,
  onTournamentChange,
}: Props) {
  const playableMatches = useMemo(
    () =>
      getAllMatches(tournament).filter(
        (match) => match.player1 && match.player2 && !match.completed,
      ),
    [tournament],
  );

  const [selectedId, setSelectedId] = useState(
    playableMatches[0]?.id ?? "",
  );
  const [, tick] = useState(0);

  useEffect(() => {
    if (!playableMatches.some((match) => match.id === selectedId)) {
      setSelectedId(playableMatches[0]?.id ?? "");
    }
  }, [playableMatches, selectedId]);

  useEffect(() => {
    const timer = window.setInterval(
      () => tick((value) => value + 1),
      1000,
    );

    return () => window.clearInterval(timer);
  }, []);

  const match =
    playableMatches.find((item) => item.id === selectedId) ?? null;

  function saveBracket(nextBracket: TournamentBracket) {
    const updated = updateTournament(tournament.id, {
      bracket: nextBracket,
      status: nextBracket.champion ? "completed" : "live",
    });

    if (updated) onTournamentChange(updated);
  }

  function updateMatch(
    mutator: (target: BracketMatch) => void,
    shouldRecompute = false,
  ) {
    if (!tournament.bracket || !match) return;

    if (tournament.bracket.type === "double") {
      const nextBracket = updateDoubleMatch(
        tournament.bracket,
        match.id,
        mutator,
      );
      saveBracket(nextBracket);
      return;
    }

    const bracket = cloneSingleBracket(tournament.bracket);
    const target = bracket.rounds
      .flatMap((round) => round.matches)
      .find((item) => item.id === match.id);

    if (!target) return;

    mutator(target);
    saveBracket(
      shouldRecompute ? recomputeSingleBracket(bracket) : bracket,
    );
  }

  function startMatch() {
    updateMatch((target) => {
      target.status = "live";
      target.startedAt = target.startedAt ?? new Date().toISOString();
      target.score1 = target.score1 ?? 0;
      target.score2 = target.score2 ?? 0;
      target.scoreHistory = target.scoreHistory ?? [];
    });
  }

  function addPoint(player: 1 | 2) {
    updateMatch(
      (target) => {
        if (target.completed) return;

        if (target.status !== "live") {
          target.status = "live";
          target.startedAt =
            target.startedAt ?? new Date().toISOString();
        }

        target.scoreHistory = [
          ...(target.scoreHistory ?? []),
          {
            score1: target.score1 ?? 0,
            score2: target.score2 ?? 0,
            recordedAt: new Date().toISOString(),
          },
        ];

        if (player === 1) {
          target.score1 = (target.score1 ?? 0) + 1;
        } else {
          target.score2 = (target.score2 ?? 0) + 1;
        }

        const score1 = target.score1 ?? 0;
        const score2 = target.score2 ?? 0;

        if (
          score1 >= tournament.raceTo ||
          score2 >= tournament.raceTo
        ) {
          target.completed = true;
          target.status = "finished";
          target.endedAt = new Date().toISOString();
          target.winner =
            score1 > score2 ? target.player1 : target.player2;
        }
      },
      true,
    );
  }

  function undoScore() {
    updateMatch(
      (target) => {
        const history = [...(target.scoreHistory ?? [])];
        const previous = history.pop();

        if (!previous) return;

        target.score1 = previous.score1;
        target.score2 = previous.score2;
        target.scoreHistory = history;

        // Reopen a match that had automatically finished.
        if (target.completed) {
          target.completed = false;
          target.winner = null;
          target.status = "live";
          target.endedAt = null;
        }
      },
      true,
    );
  }

  if (!tournament.bracket) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
          Live Match Center
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Generate the bracket first to control live matches.
        </h2>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
          Live Match Center
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          {tournament.bracket.champion
            ? `${tournament.bracket.champion} is champion!`
            : "No playable matches"}
        </h2>
        <p className="mt-2 text-slate-400">
          All available matches have been completed.
        </p>
      </section>
    );
  }

  const elapsed = match.startedAt
    ? formatDuration(
        (match.endedAt ? new Date(match.endedAt) : new Date()).getTime() -
          new Date(match.startedAt).getTime(),
      )
    : "00:00";

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
            Live Match Center
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Control the current match
          </h2>
        </div>

        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white"
        >
          {playableMatches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.player1} vs {item.player2}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[1, 2].map((player) => {
          const name = player === 1 ? match.player1 : match.player2;
          const score =
            player === 1 ? match.score1 ?? 0 : match.score2 ?? 0;

          return (
            <div
              key={player}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-white">
                  {name}
                </span>
                <span className="text-4xl font-black text-cyan-300">
                  {score}
                </span>
              </div>

              <button
                type="button"
                onClick={() => addPoint(player as 1 | 2)}
                className="mt-4 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 hover:bg-cyan-300"
              >
                +1 {name}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Race to
          </p>
          <p className="mt-1 text-xl font-black text-white">
            {tournament.raceTo}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Match timer
          </p>
          <p className="mt-1 text-xl font-black text-white">{elapsed}</p>
        </div>

        <label className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-bold text-slate-300">
          Table assignment
          <input
            value={match.tableNumber ?? ""}
            onChange={(event) =>
              updateMatch((target) => {
                target.tableNumber = event.target.value;
              })
            }
            placeholder="e.g. Table 2"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
          />
        </label>

        <label className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-bold text-slate-300">
          Break indicator
          <select
            value={match.breakPlayer ?? ""}
            onChange={(event) =>
              updateMatch((target) => {
                target.breakPlayer = event.target.value
                  ? (Number(event.target.value) as 1 | 2)
                  : null;
              })
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
          >
            <option value="">Not set</option>
            <option value="1">{match.player1}</option>
            <option value="2">{match.player2}</option>
          </select>
        </label>
      </div>

      <label className="mt-4 block text-sm font-bold text-slate-300">
        Match notes
        <textarea
          value={match.notes ?? ""}
          onChange={(event) =>
            updateMatch((target) => {
              target.notes = event.target.value;
            })
          }
          placeholder="Optional notes"
          rows={3}
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
        />
      </label>

      <div className="mt-5 flex flex-wrap gap-3">
        {match.status !== "live" ? (
          <button
            type="button"
            onClick={startMatch}
            className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950"
          >
            Start match
          </button>
        ) : null}

        <button
          type="button"
          onClick={undoScore}
          disabled={!match.scoreHistory?.length}
          className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Undo last score
        </button>
      </div>

      <p className="mt-4 text-sm text-slate-400">
        The match finishes automatically when a player reaches the race
        target. Every score saves instantly.
      </p>
    </section>
  );
}
