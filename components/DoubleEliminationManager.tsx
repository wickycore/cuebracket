"use client";

import { useMemo, useState } from "react";

import { LateEntryPanel } from "@/components/LateEntryPanel";
import { OrganizerMatchQueue } from "@/components/OrganizerMatchQueue";
import {
  buildDoubleEliminationBracket,
  fillDoubleEliminationByeSlot,
  getDoubleEliminationLateEntrySlots,
  recomputeDoubleEliminationBracket,
} from "@/lib/bracket/doubleElimination";
import type { DoubleEliminationBracket, Tournament } from "@/lib/tournaments";
import { getTournament, updateTournament } from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
  selectedMatchId?: string;
  onSelectMatch: (matchId: string) => void;
}

function isAutomaticAdvance(match: DoubleEliminationBracket["winners"][number]["matches"][number]) {
  return match.completed && Boolean(match.player1) !== Boolean(match.player2);
}

export function DoubleEliminationManager({
  tournament,
  onTournamentChange,
  selectedMatchId,
  onSelectMatch,
}: Props) {
  const [message, setMessage] = useState("");
  const bracket = tournament.bracket?.type === "double" ? tournament.bracket : undefined;

  const completed = useMemo(() => {
    if (!bracket) return 0;
    return [...bracket.winners, ...bracket.losers, ...bracket.grandFinal]
      .flatMap((round) => round.matches)
      .filter((match) => match.completed && match.player1 && match.player2).length;
  }, [bracket]);

  const automaticByes = useMemo(() => {
    if (!bracket) return 0;
    return [...bracket.winners, ...bracket.losers, ...bracket.grandFinal]
      .flatMap((round) => round.matches)
      .filter(isAutomaticAdvance).length;
  }, [bracket]);

  const lateEntrySlots = useMemo(
    () => (bracket ? getDoubleEliminationLateEntrySlots(bracket) : []),
    [bracket],
  );

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

  function addLatePlayer(playerName: string, matchId: string) {
    const latestTournament = getTournament(tournament.id) ?? tournament;
    const latestBracket = latestTournament.bracket?.type === "double" ? latestTournament.bracket : bracket;
    if (!latestBracket) return "The bracket has not been generated.";
    if (latestTournament.players.length >= latestTournament.bracketSize) return `This event is full at ${latestTournament.bracketSize} players.`;

    const normalizedName = playerName.trim();
    if (!normalizedName) return "Enter the late player's name.";
    if (latestTournament.players.some((player) => player.toLowerCase() === normalizedName.toLowerCase())) return "That player is already in the tournament.";

    const availableSlot = getDoubleEliminationLateEntrySlots(latestBracket).find(
      (slot) => slot.matchId === matchId && slot.available,
    );
    if (!availableSlot) return "That BYE slot is no longer available. Refresh and choose another open slot.";

    const result = fillDoubleEliminationByeSlot(latestBracket, matchId, normalizedName);
    if (!result.ok) return result.reason;

    const updated = updateTournament(latestTournament.id, {
      players: [...latestTournament.players, normalizedName],
      bracket: result.bracket,
      status: latestTournament.status === "completed" ? "live" : latestTournament.status,
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
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Each player is eliminated only after a second loss. BYEs are handled automatically.</p>
        {message ? <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">{message}</p> : null}
        <button type="button" onClick={generate} className="mt-5 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-300">Generate double bracket</button>
      </section>
    );
  }

  const grandFinalRounds = bracket.grandFinal.filter((round) => round.round === 1 || bracket.resetRequired);

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
      {message ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">{message}</p> : null}

      <OrganizerMatchQueue
        sections={[
          { name: "Winners", tone: "cyan", rounds: bracket.winners },
          { name: "Losers", tone: "rose", rounds: bracket.losers },
          { name: "Grand Final", tone: "violet", rounds: grandFinalRounds },
        ]}
        selectedMatchId={selectedMatchId}
        onSelectMatch={onSelectMatch}
        publicUrl={`/cloud/live/${tournament.id}`}
      />

      <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <summary className="cursor-pointer list-none font-black text-slate-200">
          <span className="flex items-center justify-between gap-3"><span>Tournament tools</span><span className="text-sm font-bold text-slate-500">Late entry · Final reset · Reset</span></span>
        </summary>
        <div className="mt-5 grid gap-4 border-t border-white/10 pt-5">
          <div className="text-sm text-slate-400">{completed} played match{completed === 1 ? "" : "es"}{automaticByes ? ` · ${automaticByes} automatic BYE${automaticByes === 1 ? "" : "s"}` : ""}</div>
          <LateEntryPanel slots={lateEntrySlots} remainingCapacity={tournament.bracketSize - tournament.players.length} onAdd={addLatePlayer} />
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
