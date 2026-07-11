"use client";

import { useEffect, useMemo, useState } from "react";
import { BracketMatch, Tournament, TournamentBracket, formatDuration, updateTournament } from "@/lib/tournaments";

interface Props {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

function autoResolveMatch(match: BracketMatch): BracketMatch {
  if (match.player1 && !match.player2) return { ...match, winner: match.player1, completed: true, status: "finished" };
  if (!match.player1 && match.player2) return { ...match, winner: match.player2, completed: true, status: "finished" };
  return match;
}

function recomputeBracket(bracket: TournamentBracket): TournamentBracket {
  const rounds = bracket.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match, scoreHistory: [...(match.scoreHistory ?? [])] })),
  }));

  for (let roundIndex = 1; roundIndex < rounds.length; roundIndex += 1) {
    const previous = rounds[roundIndex - 1].matches;
    const current = rounds[roundIndex].matches;
    current.forEach((match, position) => {
      const player1 = previous[position * 2]?.winner ?? null;
      const player2 = previous[position * 2 + 1]?.winner ?? null;
      const changed = match.player1 !== player1 || match.player2 !== player2;
      match.player1 = player1;
      match.player2 = player2;
      if (changed) {
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
  return { ...bracket, rounds, champion: final?.completed ? final.winner : null };
}

function cloneBracket(bracket: TournamentBracket) {
  return {
    ...bracket,
    rounds: bracket.rounds.map((round) => ({
      ...round,
      matches: round.matches.map((match) => ({ ...match, scoreHistory: [...(match.scoreHistory ?? [])] })),
    })),
  };
}

export function LiveMatchCenter({ tournament, onTournamentChange }: Props) {
  const playableMatches = useMemo(
    () => tournament.bracket?.rounds.flatMap((round) => round.matches).filter((match) => match.player1 && match.player2 && !match.completed) ?? [],
    [tournament.bracket],
  );
  const [selectedId, setSelectedId] = useState(playableMatches[0]?.id ?? "");
  const [, tick] = useState(0);

  useEffect(() => {
    if (!playableMatches.some((match) => match.id === selectedId)) setSelectedId(playableMatches[0]?.id ?? "");
  }, [playableMatches, selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const match = playableMatches.find((item) => item.id === selectedId) ?? null;

  function updateMatch(mutator: (target: BracketMatch) => void, recompute = false) {
    if (!tournament.bracket || !match) return;
    const bracket = cloneBracket(tournament.bracket);
    const target = bracket.rounds[match.round - 1].matches[match.position];
    mutator(target);
    const nextBracket = recompute ? recomputeBracket(bracket) : bracket;
    const updated = updateTournament(tournament.id, { bracket: nextBracket, status: "live" });
    if (updated) onTournamentChange(updated);
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
      if (target.status !== "live") {
        target.status = "live";
        target.startedAt = target.startedAt ?? new Date().toISOString();
      }
      target.scoreHistory = [
        ...(target.scoreHistory ?? []),
        { score1: target.score1 ?? 0, score2: target.score2 ?? 0, recordedAt: new Date().toISOString() },
      ];
      if (player === 1) target.score1 = (target.score1 ?? 0) + 1;
      else target.score2 = (target.score2 ?? 0) + 1;
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
    });
  }

  function finishMatch() {
    if (!match) return;
    const score1 = match.score1 ?? 0;
    const score2 = match.score2 ?? 0;
    if (score1 === score2) {
      window.alert("The match cannot finish with a tied score.");
      return;
    }
    if (Math.max(score1, score2) < tournament.raceTo) {
      const confirmed = window.confirm(`Neither player has reached race to ${tournament.raceTo}. Finish anyway?`);
      if (!confirmed) return;
    }
    updateMatch((target) => {
      target.completed = true;
      target.status = "finished";
      target.endedAt = new Date().toISOString();
      target.winner = (target.score1 ?? 0) > (target.score2 ?? 0) ? target.player1 : target.player2;
    }, true);
  }

  if (!tournament.bracket) {
    return (
      <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-4xl">🎛️</p>
        <h2 className="mt-3 text-2xl font-black">Live Match Center</h2>
        <p className="mt-2 text-slate-400">Generate the bracket first to control live matches.</p>
      </section>
    );
  }

  if (!match) {
    return (
      <section className="mt-8 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-8 text-center">
        <p className="text-5xl">🏆</p>
        <h2 className="mt-3 text-3xl font-black">{tournament.bracket.champion ? `${tournament.bracket.champion} is champion!` : "No playable matches"}</h2>
        <p className="mt-2 text-emerald-100/70">All available matches have been completed.</p>
      </section>
    );
  }

  const elapsed = match.startedAt
    ? formatDuration((match.endedAt ? new Date(match.endedAt) : new Date()).getTime() - new Date(match.startedAt).getTime())
    : "00:00";

  return (
    <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/[0.08] via-white/[0.04] to-violet-400/[0.08] p-6 shadow-2xl shadow-cyan-950/30 sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${match.status === "live" ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`} />
            <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Live Match Center</p>
          </div>
          <h2 className="mt-2 text-2xl font-black">Control the current match</h2>
        </div>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold text-white">
          {playableMatches.map((item) => (
            <option key={item.id} value={item.id}>{item.player1} vs {item.player2}</option>
          ))}
        </select>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        {[1, 2].map((player) => {
          const name = player === 1 ? match.player1 : match.player2;
          const score = player === 1 ? match.score1 ?? 0 : match.score2 ?? 0;
          return (
            <div key={player} className="rounded-3xl border border-white/10 bg-slate-950/55 p-6 text-center">
              <p className="truncate text-xl font-black text-white">{name}</p>
              <p className="my-4 text-7xl font-black tabular-nums text-cyan-300">{score}</p>
              <button onClick={() => addPoint(player as 1 | 2)} className="w-full rounded-2xl bg-cyan-400 px-4 py-3 font-black text-slate-950 hover:bg-cyan-300">+1 {name}</button>
            </div>
          );
        })}
        <div className="order-first text-center lg:order-none">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Race to</p>
          <p className="text-5xl font-black text-white">{tournament.raceTo}</p>
          <p className="mt-3 font-mono text-xl font-bold text-emerald-300">{elapsed}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="text-sm font-bold text-slate-300">Table assignment
          <input value={match.tableNumber ?? ""} onChange={(event) => updateMatch((target) => { target.tableNumber = event.target.value; })} placeholder="e.g. Table 2" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" />
        </label>
        <label className="text-sm font-bold text-slate-300">Break indicator
          <select value={match.breakPlayer ?? ""} onChange={(event) => updateMatch((target) => { target.breakPlayer = event.target.value ? Number(event.target.value) as 1 | 2 : null; })} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white">
            <option value="">Not set</option>
            <option value="1">{match.player1}</option>
            <option value="2">{match.player2}</option>
          </select>
        </label>
        <label className="text-sm font-bold text-slate-300">Match notes
          <input value={match.notes ?? ""} onChange={(event) => updateMatch((target) => { target.notes = event.target.value; })} placeholder="Optional notes" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white" />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {match.status !== "live" ? <button onClick={startMatch} className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-slate-950">Start match</button> : null}
        <button onClick={undoScore} disabled={!match.scoreHistory?.length} className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-300 disabled:opacity-30">Undo last score</button>
        <button onClick={finishMatch} className="rounded-xl bg-violet-400 px-5 py-3 font-black text-slate-950">Finish match</button>
      </div>
      <p className="mt-4 text-xs text-slate-500">Changes save automatically after every click and restore after refresh.</p>
    </section>
  );
}
