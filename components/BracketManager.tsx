"use client";

import { useMemo, useState } from "react";

import { DoubleEliminationManager } from "@/components/DoubleEliminationManager";
import { LateEntryPanel } from "@/components/LateEntryPanel";
import { PlayerNameEditor } from "@/components/PlayerNameEditor";
import {
  DRAW_LOCKED_MESSAGE,
  getKnockoutDrawCapacity,
  isDrawEditable,
} from "@/lib/bracket/drawIntegrity";
import {
  buildSingleEliminationBracket,
  countSingleEliminationAutomaticByes,
  countSingleEliminationPlayedMatches,
  fillSingleEliminationByeSlot,
  getSingleEliminationLateEntrySlots,
} from "@/lib/bracket/singleElimination";
import type { Tournament, TournamentBracket } from "@/lib/tournaments";
import { getTournament, updateTournament } from "@/lib/tournaments";

interface BracketManagerProps {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
  selectedMatchId?: string;
  onSelectMatch: (matchId: string) => void;
}

export function BracketManager(props: BracketManagerProps) {
  if (props.tournament.format === "double") return <DoubleEliminationManager {...props} />;
  return <SingleEliminationManager {...props} />;
}

function SingleEliminationManager({ tournament, onTournamentChange }: BracketManagerProps) {
  const [message, setMessage] = useState("");
  const bracket = tournament.bracket?.type === "single" ? tournament.bracket : undefined;
  const canGenerate = tournament.players.length >= 2;
  const drawEditable = isDrawEditable(tournament.status);

  const playedMatches = useMemo(
    () => (bracket ? countSingleEliminationPlayedMatches(bracket) : 0),
    [bracket],
  );
  const automaticByes = useMemo(
    () => (bracket ? countSingleEliminationAutomaticByes(bracket) : 0),
    [bracket],
  );
  const rawLateEntrySlots = useMemo(
    () => (bracket ? getSingleEliminationLateEntrySlots(bracket) : []),
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

  function saveBracket(nextBracket: TournamentBracket | undefined) {
    let status = tournament.status;
    if (!nextBracket) status = "draft";
    else if (nextBracket.champion) status = "completed";
    else if (nextBracket.type === "single" && countSingleEliminationPlayedMatches(nextBracket) > 0) status = "live";
    else if (tournament.status === "completed") status = "live";

    const updated = updateTournament(tournament.id, { bracket: nextBracket, status });
    if (updated) onTournamentChange(updated);
  }

  function generateBracket() {
    setMessage("");
    if (!canGenerate) {
      setMessage("Add at least two players before generating the bracket.");
      return;
    }

    // The configured event capacity is not the draw size. Build the smallest
    // power-of-two draw that holds the current field: 30 -> 32, 48 -> 64, etc.
    saveBracket(buildSingleEliminationBracket(tournament.players));
  }

  function resetBracket() {
    if (!window.confirm("Reset this competition and remove every entered single-elimination result?")) return;
    setMessage("");
    saveBracket(undefined);
  }

  function addLatePlayer(playerName: string, matchId: string) {
    const latestTournament = getTournament(tournament.id) ?? tournament;
    const latestBracket = latestTournament.bracket?.type === "single" ? latestTournament.bracket : bracket;
    if (!latestBracket) return "The bracket has not been generated.";
    if (!isDrawEditable(latestTournament.status)) return DRAW_LOCKED_MESSAGE;

    const latestDrawCapacity = getKnockoutDrawCapacity(latestBracket);
    if (latestTournament.players.length >= latestTournament.bracketSize) {
      return `This event is full at ${latestTournament.bracketSize} players.`;
    }
    if (latestTournament.players.length >= latestDrawCapacity) {
      return `This ${latestDrawCapacity}-player draw is full. Reset the draft, add the extra players, then regenerate before starting.`;
    }
    if (latestTournament.players.some((player) => player.toLowerCase() === playerName.toLowerCase())) {
      return "That player is already in the tournament.";
    }

    const result = fillSingleEliminationByeSlot(latestBracket, matchId, playerName);
    if (!result.ok) return result.reason;

    const updated = updateTournament(latestTournament.id, {
      players: [...latestTournament.players, playerName],
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
        <span className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Single elimination</span>
        <h2 className="mt-2 text-2xl font-black text-white">Generate the tournament bracket</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          The player order becomes the draw order. CueBracket creates the smallest valid knockout draw and spreads empty first-round slots as BYEs. BYEs are empty slots, not fake players or played matches.
        </p>
        {message ? <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">{message}</p> : null}
        <button type="button" onClick={generateBracket} className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300">Generate bracket</button>
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
            {playedMatches} played match{playedMatches === 1 ? "" : "es"}{automaticByes ? ` · ${automaticByes} automatic BYE${automaticByes === 1 ? "" : "s"}` : ""} · {drawCapacity}-player draw
          </div>
          <PlayerNameEditor tournament={tournament} onTournamentChange={onTournamentChange} />
          <LateEntryPanel
            slots={lateEntrySlots}
            remainingCapacity={remainingDrawSlots}
            onAdd={addLatePlayer}
          />
          <button type="button" onClick={resetBracket} className="w-fit rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10">Reset competition</button>
        </div>
      </details>
    </div>
  );
}
