"use client";

import { useMemo, useState } from "react";

import { LateEntryPanel } from "@/components/LateEntryPanel";
import { PlayerNameEditor } from "@/components/PlayerNameEditor";
import {
  buildDoubleEliminationBracket,
  fillDoubleEliminationByeSlot,
  getDoubleEliminationLateEntrySlots,
  recomputeDoubleEliminationBracket,
} from "@/lib/bracket/doubleElimination";
import {
  DRAW_LOCKED_MESSAGE,
  getFirstRoundByeCount,
  getKnockoutDrawCapacity,
  getKnockoutDrawSize,
  isDrawEditable,
} from "@/lib/bracket/drawIntegrity";
import type { DoubleEliminationBracket, Tournament } from "@/lib/tournaments";
import { getTournament, updateTournament } from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
  selectedMatchId?: string;
  onSelectMatch: (matchId: string) => void;
}

export function DoubleEliminationManager({
  tournament,
  onTournamentChange,
}: Props) {
  const [message, setMessage] = useState("");
  const bracket = tournament.bracket?.type === "double" ? tournament.bracket : undefined;
  const drawEditable = isDrawEditable(tournament.status);

  const completed = useMemo(() => {
    if (!bracket) return 0;
    return [...bracket.winners, ...bracket.losers, ...bracket.grandFinal]
      .flatMap((round) => round.matches)
      .filter((match) => match.completed && match.player1 && match.player2).length;
  }, [bracket]);

  const automaticByes = useMemo(
    () => (bracket ? getFirstRoundByeCount(bracket) : 0),
    [bracket],
  );

  const rawLateEntrySlots = useMemo(
    () => (bracket ? getDoubleEliminationLateEntrySlots(bracket) : []),
    [bracket],
  );
  const lateEntrySlots = useMemo(
    () =>
      drawEditable
        ? rawLateEntrySlots
        : rawLateEntrySlots.map((slot) => ({
            ...slot,
            available: false,
            lockedReason: DRAW_LOCKED_MESSAGE,
          })),
    [drawEditable, rawLateEntrySlots],
  );
  const drawCapacity = bracket ? getKnockoutDrawCapacity(bracket) : 0;
  const remainingDrawSlots = Math.max(
    0,
    Math.min(drawCapacity, tournament.bracketSize) - tournament.players.length,
  );

  function saveBracket(next: DoubleEliminationBracket | undefined) {
    let status = tournament.status;
    if (!next) status = "draft";
    else if (next.champion) status = "completed";
    else if (tournament.status === "completed") status = "live";

    const updated = updateTournament(tournament.id, { bracket: next, status });
    if (updated) onTournamentChange(updated);
  }

  function generate() {
    if (tournament.players.length < 2) {
      setMessage("Add at least two players before generating the bracket.");
      return;
    }
    setMessage("");

    // Registration capacity and draw capacity are separate. For example,
    // a 64-capacity event with 30 checked-in players gets a 32-player draw.
    const activeDrawSize = getKnockoutDrawSize(tournament.players.length);
    saveBracket(
      buildDoubleEliminationBracket({
        ...tournament,
        bracketSize: activeDrawSize,
      }),
    );
  }

  function addLatePlayer(playerName: string, matchId: string) {
    const latestTournament = getTournament(tournament.id) ?? tournament;
    const latestBracket = latestTournament.bracket?.type === "double" ? latestTournament.bracket : bracket;
    if (!latestBracket) return "The bracket has not been generated.";
    if (!isDrawEditable(latestTournament.status)) return DRAW_LOCKED_MESSAGE;

    const latestDrawCapacity = getKnockoutDrawCapacity(latestBracket);
    if (latestTournament.players.length >= latestTournament.bracketSize) {
      return `This event is full at ${latestTournament.bracketSize} players.`;
    }
    if (latestTournament.players.length >= latestDrawCapacity) {
      return `This ${latestDrawCapacity}-player draw is full. Reset the draft, add the extra players, then regenerate before starting.`;
    }

    const normalizedName = playerName.trim();
    if (!normalizedName) return "Enter the late player's name.";
    if (latestTournament.players.some((player) => player.toLowerCase() === normalizedName.toLowerCase())) {
      return "That player is already in the tournament.";
    }

    const availableSlot = getDoubleEliminationLateEntrySlots(latestBracket).find(
      (slot) => slot.matchId === matchId && slot.available,
    );
    if (!availableSlot) return "That BYE slot is no longer available. Refresh and choose another open slot.";

    const result = fillDoubleEliminationByeSlot(latestBracket, matchId, normalizedName);
    if (!result.ok) return result.reason;

    const updated = updateTournament(latestTournament.id, {
      players: [...latestTournament.players, normalizedName],
      bracket: result.bracket,
      status: "draft",
    });
    if (!updated) return "The late player could not be saved.";

    setMessage("");
    onTournamentChange(updated);
    return null;
  }

  if (!bracket) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl">
        <span className="text-3xl">♻️</span>
        <h2 className="mt-3 text-2xl font-black text-white">Generate the double-elimination bracket</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Each player is eliminated only after a second loss. CueBracket builds the smallest valid knockout draw for the checked-in field; BYEs are empty first-round slots and never count as played matches.
        </p>
        {message ? <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">{message}</p> : null}
        <button type="button" onClick={generate} className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300">Generate double bracket</button>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      {bracket.champion ? (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Tournament champion</span>
          <h3 className="mt-2 text-2xl font-black text-white">🏆 {bracket.champion}</h3>
        </div>
      ) : bracket.resetRequired ? (
        <div className="rounded-2xl border border-violet-400/25 bg-violet-400/10 p-4 text-sm font-bold text-violet-200">Grand Final reset match required.</div>
      ) : null}

      {tournament.status === "draft" ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <span className="font-black">Draw preview · {drawCapacity} slots.</span>{" "}
          BYE positions can still be filled explicitly. Press <span className="font-black">Start Tournament</span> above when the draw is final; after that, positions are frozen.
        </div>
      ) : !bracket.champion ? (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-100">
          🔒 Draw locked — player positions and BYEs are frozen for bracket integrity.
        </div>
      ) : null}

      {message ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">{message}</p> : null}

      <div className="flex justify-end">
        <a data-cb-hard-navigation="true" href={`/cloud/live/${tournament.id}`} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2.5 text-sm font-black text-cyan-200 hover:bg-cyan-400/15">
          View full bracket ↗
        </a>
      </div>

      <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <summary className="cursor-pointer list-none font-black text-slate-200">
          <span className="flex items-center justify-between gap-3"><span>Tournament tools</span><span className="text-sm font-bold text-slate-400">Names · Late entry · Reset</span></span>
        </summary>
        <div className="mt-5 grid gap-4 border-t border-white/10 pt-5">
          <div className="text-sm text-slate-400">
            {completed} played match{completed === 1 ? "" : "es"}{automaticByes ? ` · ${automaticByes} first-round BYE${automaticByes === 1 ? "" : "s"}` : ""} · {drawCapacity}-player draw
          </div>
          <PlayerNameEditor tournament={tournament} onTournamentChange={onTournamentChange} />
          <LateEntryPanel
            slots={lateEntrySlots}
            remainingCapacity={remainingDrawSlots}
            onAdd={addLatePlayer}
          />
          <label className="flex w-fit min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-bold text-slate-300">
            <input
              type="checkbox"
              checked={bracket.bracketResetEnabled}
              onChange={(event) => saveBracket(recomputeDoubleEliminationBracket({ ...bracket, bracketResetEnabled: event.target.checked }))}
            />
            Grand-final reset
          </label>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset this competition and remove all scores?")) saveBracket(undefined);
            }}
            className="w-fit rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
          >
            Reset competition
          </button>
        </div>
      </details>
    </div>
  );
}
