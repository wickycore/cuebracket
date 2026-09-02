"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { updateDoubleMatch } from "@/lib/bracket/doubleElimination";
import { updateSingleEliminationMatch } from "@/lib/bracket/singleElimination";
import { recordMatchStarted } from "@/lib/cloud/notifications";
import {
  assignVenueTable,
  getEventVenueTables,
  releaseVenueTable,
  subscribeToVenueTables,
  type VenueTableRow,
} from "@/lib/cloud/tables";
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
  const [venueTables, setVenueTables] = useState<VenueTableRow[]>([]);
  const [tableMessage, setTableMessage] = useState("");
  const tableScope = useMemo(() => ({
    id: tournament.id,
    clubId: tournament.clubId ?? null,
    type: "tournament" as const,
  }), [tournament.clubId, tournament.id]);

  function selectMatch(matchId: string) {
    setInternalSelectedId(matchId);
    onSelectedMatchChange?.(matchId);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadTables = async () => {
      try {
        const rows = await getEventVenueTables(tableScope);
        if (active) setVenueTables(rows);
      } catch (error) {
        if (active) setTableMessage(error instanceof Error ? error.message : "Unable to load venue tables.");
      }
    };
    void loadTables();
    const unsubscribe = subscribeToVenueTables(() => void loadTables());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [tableScope]);

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

  async function markAssignedTablePlaying(targetMatch: BracketMatch) {
    if (!targetMatch.tableId) return;
    await assignVenueTable({
      tableId: targetMatch.tableId,
      scope: tableScope,
      matchId: targetMatch.id,
      matchLabel: `${targetMatch.player1} vs ${targetMatch.player2}`,
      status: "playing",
    });
  }

  async function startMatch() {
    if (!match) return;
    try {
      await markAssignedTablePlaying(match);
      setTableMessage("");
    } catch (error) {
      setTableMessage(error instanceof Error ? error.message : "Unable to start this match on the selected table.");
      return;
    }
    void recordMatchStarted(tournament, match).catch(() => undefined);
    updateMatch((target) => {
      target.status = "live";
      target.startedAt = target.startedAt ?? new Date().toISOString();
      target.score1 = target.score1 ?? 0;
      target.score2 = target.score2 ?? 0;
      target.scoreHistory = target.scoreHistory ?? [];
    });
  }

  async function addPoint(player: 1 | 2) {
    if (!match) return;
    if (match.status !== "live" && !match.completed) {
      try {
        await markAssignedTablePlaying(match);
        setTableMessage("");
      } catch (error) {
        setTableMessage(error instanceof Error ? error.message : "Unable to use the selected table.");
        return;
      }
    }
    if (match && match.status !== "live" && !match.completed) {
      void recordMatchStarted(tournament, match).catch(() => undefined);
    }
    const finishesMatch = player === 1
      ? (match.score1 ?? 0) + 1 >= tournament.raceTo
      : (match.score2 ?? 0) + 1 >= tournament.raceTo;
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
    if (finishesMatch && match.tableId) {
      void releaseVenueTable({ tableId: match.tableId, scope: tableScope, matchId: match.id })
        .catch((error) => setTableMessage(error instanceof Error ? error.message : "Result saved, but the table could not be released."));
    }
  }

  async function assignTable(tableId: number | null) {
    if (!match || match.completed) return;
    const oldTableId = match.tableId ?? null;
    if (oldTableId === tableId) return;
    try {
      if (oldTableId) await releaseVenueTable({ tableId: oldTableId, scope: tableScope, matchId: match.id });
      const table = venueTables.find((item) => item.id === tableId);
      if (table) {
        await assignVenueTable({
          tableId: table.id,
          scope: tableScope,
          matchId: match.id,
          matchLabel: `${match.player1} vs ${match.player2}`,
          status: match.status === "live" ? "playing" : "reserved",
        });
      }
      updateMatch((target) => {
        target.tableId = table?.id ?? null;
        target.tableNumber = table?.name ?? "";
      });
      setTableMessage("");
    } catch (error) {
      setTableMessage(error instanceof Error ? error.message : "Unable to assign that table.");
    }
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
                onClick={() => void addPoint(player)}
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
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Race to
          </p>
          <p className="mt-1 text-xl font-black text-white">
            {tournament.raceTo}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Match timer
          </p>
          <p className="mt-1 text-xl font-black text-white">{elapsed}</p>
        </div>
        <label className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-bold text-slate-300">
          Table assignment
          <select
            value={match.tableId ?? ""}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => void assignTable(event.target.value ? Number(event.target.value) : null)}
            disabled={match.completed}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white"
          >
            <option value="">{venueTables.length ? "No table" : "Add tables in Floor Control"}</option>
            {venueTables.map((table) => {
              const busy = Boolean(table.active_match_id && table.active_match_id !== match.id);
              return <option key={table.id} value={table.id} disabled={busy}>{table.name}{busy ? ` · ${table.active_match_label || "Busy"}` : table.status !== "available" && table.active_match_id !== match.id ? ` · ${table.status}` : ""}</option>;
            })}
          </select>
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

      {tableMessage ? <p className="mt-4 rounded-xl bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">{tableMessage}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {!match.startedAt && !match.completed ? (
          <button
            type="button"
            onClick={() => void startMatch()}
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
