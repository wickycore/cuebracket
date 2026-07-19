"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { updateDoubleMatch } from "@/lib/bracket/doubleElimination";
import { updateSingleEliminationMatch } from "@/lib/bracket/singleElimination";
import type { BracketMatch, Tournament, TournamentBracket } from "@/lib/tournaments";
import {
  formatDuration,
  getAllMatches,
  updateTournament,
} from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
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
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
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

  function updateMatch(mutator: (target: BracketMatch) => void) {
    if (!tournament.bracket || !match) return;

    const nextBracket =
      tournament.bracket.type === "double"
        ? updateDoubleMatch(tournament.bracket, match.id, mutator)
        : updateSingleEliminationMatch(
            tournament.bracket,
            match.id,
            mutator,
          );

    saveBracket(nextBracket);
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
    updateMatch((target) => {
      if (target.completed) return;
      if (target.status !== "live") {
        target.status = "live";
        target.startedAt = target.startedAt ?? new Date().toISOString();
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
        target.score1 = Math.min(
          tournament.raceTo,
          (target.score1 ?? 0) + 1,
        );
      } else {
        target.score2 = Math.min(
          tournament.raceTo,
          (target.score2 ?? 0) + 1,
        );
      }

      const score1 = target.score1 ?? 0;
      const score2 = target.score2 ?? 0;
      if (score1 === tournament.raceTo || score2 === tournament.raceTo) {
        target.completed = true;
        target.status = "finished";
        target.endedAt = new Date().toISOString();
        target.winner = score1 > score2 ? target.player1 : target.player2;
      }
    });
  }

  function undoScore() {
    updateMatch((target) => {
      const history = [...(target.scoreHistory ?? [])];
      const previous = history.pop();
      if (!previous) return;
      target.score1 = previous.score1;
      target.score2 = previous.score2;
      target.scoreHistory = history;
      target.completed = false;
      target.winner = null;
      target.status = "live";
      target.endedAt = null;
    });
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
            : "No playable matches right now"}
        </h2>
        <p className="mt-2 text-slate-400">
          {tournament.bracket.champion
            ? "The final has been completed."
            : "Finish the feeder matches to unlock the next fixture."}
        </p>
      </section>
    );
  }

  const elapsed = match.startedAt
    ? formatDuration(
        new Date(match.endedAt ?? Date.now()).getTime() -
          new Date(match.startedAt).getTime(),
      )
    : "00:00";

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 sm:p-6">
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
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedId(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white lg:w-auto"
        >
          {playableMatches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.player1} vs {item.player2}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {([1, 2] as const).map((player) => {
          const name = player === 1 ? match.player1 : match.player2;
          const score = player === 1 ? match.score1 ?? 0 : match.score2 ?? 0;
          return (
            <div
              key={player}
              className="rounded-2xl border border-white/10 bg-slate-950/60 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-lg font-black text-white">
                  {name}
                </span>
                <span className="text-4xl font-black text-cyan-300">{score}</span>
              </div>
              <button
                type="button"
                onClick={() => addPoint(player)}
                className="mt-4 min-h-12 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 hover:bg-cyan-300"
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
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              updateMatch((target) => {
                target.tableNumber = event.target.value;
              })
            }
            placeholder="e.g. Table 2"
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
          />
        </label>
        <label className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-bold text-slate-300">
          Breaker
          <select
            value={match.breakPlayer ?? ""}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
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
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            updateMatch((target) => {
              target.notes = event.target.value;
            })
          }
          rows={2}
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
        />
      </label>

      <div className="mt-5 flex flex-wrap gap-3">
        {!match.startedAt ? (
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
          className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Undo last point
        </button>
      </div>
    </section>
  );
}
