"use client";

import { useEffect, useMemo, useState } from "react";

import { DoubleEliminationManager } from "@/components/DoubleEliminationManager";
import { LateEntryPanel } from "@/components/LateEntryPanel";
import { OrganizerMatchQueue } from "@/components/OrganizerMatchQueue";
import {
  buildSingleEliminationBracket,
  countSingleEliminationAutomaticByes,
  countSingleEliminationPlayedMatches,
  fillSingleEliminationByeSlot,
  getSingleEliminationLateEntrySlots,
  recomputeSingleEliminationBracket,
} from "@/lib/bracket/singleElimination";
import type { Tournament, TournamentBracket } from "@/lib/tournaments";
import { getTournament, updateTournament } from "@/lib/tournaments";

interface BracketManagerProps {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
  selectedMatchId?: string;
  onSelectMatch: (matchId: string) => void;
}

function bracketFingerprint(bracket: TournamentBracket | undefined) {
  return JSON.stringify(bracket ?? null);
}

export function BracketManager(props: BracketManagerProps) {
  if (props.tournament.format === "double") return <DoubleEliminationManager {...props} />;
  return <SingleEliminationManager {...props} />;
}

function SingleEliminationManager({ tournament, onTournamentChange, selectedMatchId, onSelectMatch }: BracketManagerProps) {
  const [message, setMessage] = useState("");
  const bracket = tournament.bracket?.type === "single" ? tournament.bracket : undefined;
  const canGenerate = tournament.players.length >= 2;

  const playedMatches = useMemo(() => (bracket ? countSingleEliminationPlayedMatches(bracket) : 0), [bracket]);
  const automaticByes = useMemo(() => (bracket ? countSingleEliminationAutomaticByes(bracket) : 0), [bracket]);
  const lateEntrySlots = useMemo(() => (bracket ? getSingleEliminationLateEntrySlots(bracket) : []), [bracket]);

  useEffect(() => {
    if (!bracket) return;

    const sourceFingerprint = bracketFingerprint(bracket);
    const latestTournament = getTournament(tournament.id);
    const latestBracket = latestTournament?.bracket?.type === "single" ? latestTournament.bracket : undefined;

    if (!latestTournament || !latestBracket || bracketFingerprint(latestBracket) !== sourceFingerprint) return;

    let repaired = recomputeSingleEliminationBracket(latestBracket);
    if (countSingleEliminationPlayedMatches(repaired) === 0) {
      const firstRoundPlayers = new Set<string>();
      for (const match of repaired.rounds[0]?.matches ?? []) {
        if (match.player1) firstRoundPlayers.add(match.player1.toLowerCase());
        if (match.player2) firstRoundPlayers.add(match.player2.toLowerCase());
      }

      const missingPlayers = latestTournament.players.filter((player) => !firstRoundPlayers.has(player.toLowerCase()));
      const openSlots = getSingleEliminationLateEntrySlots(repaired).filter((slot) => slot.available);
      if (missingPlayers.length === 1 && openSlots.length === 1) {
        const recovered = fillSingleEliminationByeSlot(repaired, openSlots[0].matchId, missingPlayers[0]);
        if (recovered.ok) repaired = recovered.bracket;
      }
    }

    const repairedStatus = repaired.champion ? "completed" : latestTournament.status === "completed" ? "live" : latestTournament.status;
    if (bracketFingerprint(repaired) === bracketFingerprint(latestBracket) && repairedStatus === latestTournament.status) return;

    const updated = updateTournament(latestTournament.id, { bracket: repaired, status: repairedStatus });
    if (updated) onTournamentChange(updated);
  }, [bracket, onTournamentChange, tournament.id]);

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
    saveBracket(buildSingleEliminationBracket(tournament.players, tournament.bracketSize));
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
    if (latestTournament.players.length >= latestTournament.bracketSize) return `This event is full at ${latestTournament.bracketSize} players.`;
    if (latestTournament.players.some((player) => player.toLowerCase() === playerName.toLowerCase())) return "That player is already in the tournament.";

    const result = fillSingleEliminationByeSlot(latestBracket, matchId, playerName);
    if (!result.ok) return result.reason;

    const updated = updateTournament(latestTournament.id, {
      players: [...latestTournament.players, playerName],
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
        <span className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Single elimination</span>
        <h2 className="mt-2 text-2xl font-black text-white">Generate the tournament bracket</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">The player order becomes the draw order. Empty first-round places are distributed as automatic BYEs.</p>
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
      {message ? <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200">{message}</p> : null}

      <OrganizerMatchQueue
        sections={[{ name: "Bracket", tone: "cyan", rounds: bracket.rounds }]}
        selectedMatchId={selectedMatchId}
        onSelectMatch={onSelectMatch}
        publicUrl={`/cloud/live/${tournament.id}`}
      />

      <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <summary className="cursor-pointer list-none font-black text-slate-200">
          <span className="flex items-center justify-between gap-3"><span>Tournament tools</span><span className="text-sm font-bold text-slate-500">Late entry · Reset</span></span>
        </summary>
        <div className="mt-5 grid gap-4 border-t border-white/10 pt-5">
          <div className="text-sm text-slate-400">
            {playedMatches} played match{playedMatches === 1 ? "" : "es"}{automaticByes ? ` · ${automaticByes} automatic BYE${automaticByes === 1 ? "" : "s"}` : ""}
          </div>
          <LateEntryPanel slots={lateEntrySlots} remainingCapacity={tournament.bracketSize - tournament.players.length} onAdd={addLatePlayer} />
          <button type="button" onClick={resetBracket} className="w-fit rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10">Reset competition</button>
        </div>
      </details>
    </div>
  );
}
