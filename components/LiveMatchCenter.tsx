"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { updateDoubleMatch } from "@/lib/bracket/doubleElimination";
import { updateSingleEliminationMatch } from "@/lib/bracket/singleElimination";
import { recordMatchStarted } from "@/lib/cloud/notifications";
import type { BracketMatch, Tournament, TournamentBracket } from "@/lib/tournaments";
import {
  formatDuration,
  getAllMatches,
  updateTournament,
} from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
  selectedMatchId?: string;
  onSelectedMatchChange?: (matchId: string) => void;
}

export function LiveMatchCenter({
  tournament,
  onTournamentChange,
  selectedMatchId,
  onSelectedMatchChange,
}: Props) {
  const allMatches = useMemo(() => getAllMatches(tournament), [tournament]);
  const playableMatches = useMemo(
    () =>
      allMatches.filter(
        (match) => match.player1 && match.player2 && !match.completed,
      ),
    [allMatches],
  );
  const selectableMatches = useMemo(
    () => allMatches.filter((match) => match.player1 && match.player2),
    [allMatches],
  );
  const [internalSelectedId, setInternalSelectedId] = useState(
    playableMatches[0]?.id ?? "",
  );
  const requestedSelectedId = selectedMatchId ?? internalSelectedId;
  const selectedId = selectableMatches.some(
    (match) => match.id === requestedSelectedId,
  )
    ? requestedSelectedId
    : playableMatches[0]?.id ?? selectableMatches[0]?.id ?? "";
  const [now, setNow] = useState(() => Date.now());

  function selectMatch(matchId: string) {
    setInternalSelectedId(matchId);
    onSelectedMatchChange?.(matchId);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const match =
    selectableMatches.find((item) => item.id === selectedId) ?? null;

  function hasActiveDependent(sourceMatchId: string) {
    const visited = new Set<string>();
    const pending = [sourceMatchId];

    while (pending.length) {
      const currentId = pending.shift();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);

      for (const candidate of allMatches) {
        const dependsOnCurrent = [candidate.source1, candidate.source2].some(
          (source) =>
            source?.kind !== "seed" && source?.matchId === currentId,
        );
        if (!dependsOnCurrent) continue;
        if (
          candidate.completed ||
          candidate.status === "live" ||
          candidate.score1 !== null ||
          candidate.score2 !== null
        ) {
          return true;
        }
        pending.push(candidate.id);
      }
    }

    return false;
  }

  function confirmResultCorrection() {
    const dependentWarning = match && hasActiveDependent(match.id)
      ? " A later match already has activity; reopening this result will clear affected progression."
      : " Later bracket progression will be recalculated automatically.";
    return window.confirm(
      `Reopen this finished match?${dependentWarning}`,
    );
  }

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
    if (match) void recordMatchStarted(tournament, match).catch(() => undefined);
    updateMatch((target) => {
      target.status = "live";
      target.startedAt = target.startedAt ?? new Date().toISOString();
      target.score1 = target.score1 ?? 0;
      target.score2 = target.score2 ?? 0;
      target.scoreHistory = target.scoreHistory ?? [];
    });
  }

  function addPoint(player: 1 | 2) {
    if (match && match.status !== "live" && !match.completed) {
      void recordMatchStarted(tournament, match).catch(() => undefined);
    }
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
    if (match?.completed && !confirmResultCorrection()) return;
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

  function clearCompletedResult() {
    if (!match?.completed || !confirmResultCorrection()) return;
    updateMatch((target) => {
      target.score1 = 0;
      target.score2 = 0;
      target.scoreHistory = [];
      target.completed = false;
      target.winner = null;
      target.status = "live";
      target.startedAt = target.startedAt ?? new Date().toISOString();
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
        (match.endedAt ? new Date(match.endedAt).getTime() : now) -
          new Date(match.startedAt).getTime(),
      )
    : "00:00";

  return (
    <section id="live-match-center" className="scroll-mt-24 rounded-3xl border border-cyan-400/20 bg-slate-900/70 p-5 shadow-xl shadow-cyan-950/10 sm:p-6">
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
          onChange={(event: ChangeEvent<HTMLSelectElement>) => selectMatch(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white lg:w-auto"
        >
          {selectableMatches.map((item) => (
            <option key={item.id} value={item.id}>
              {item.player1} vs {item.player2}
              {item.completed ? " · Finished" : item.status === "live" ? " · Live" : ""}
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
                disabled={match.completed}
                className="mt-4 min-h-12 w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
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
        {!match.startedAt && !match.completed ? (
          <button
            type="button"
            onClick={startMatch}
            className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950"
          >
            Start match
          </button>
        ) : null}
        {match.completed ? (
          <button
            type="button"
            onClick={match.scoreHistory?.length ? undoScore : clearCompletedResult}
            className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 font-black text-amber-200 hover:bg-amber-300/15"
          >
            {match.scoreHistory?.length ? "Undo final point & reopen" : "Clear result & reopen"}
          </button>
        ) : (
          <button
            type="button"
            onClick={undoScore}
            disabled={!match.scoreHistory?.length}
            className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo last point
          </button>
        )}
      </div>
    </section>
  );
}
