"use client";

import { useState } from "react";
import {
  generateLeaguePlayoff,
  getPlayerName,
  resetLeaguePlayoffResult,
  saveLeaguePlayoffResult,
  validateLeagueResult,
  type League,
  type LeaguePlayoffMatch,
} from "@/lib/leagues";

export function LeaguePlayoffs({ league, admin = false, onChange }: { league: League; admin?: boolean; onChange?: (league: League) => void }) {
  if (!league.playoff.enabled) return null;
  const regularComplete = league.fixtures.length > 0 && league.fixtures.every((fixture) => fixture.completed);

  function generate() {
    try {
      const updated = generateLeaguePlayoff(league.id);
      if (updated) onChange?.(updated);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to generate the playoff.");
    }
  }

  return (
    <section className="rounded-3xl border border-violet-400/20 bg-violet-400/[0.055] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-300">League playoffs</p>
          <h2 className="mt-2 text-2xl font-black text-white">Top {league.playoff.qualifierCount} championship bracket</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Seeds come from the final table. Correcting a regular-season result clears the bracket so it can be seeded again safely.</p>
        </div>
        {admin && !league.playoff.rounds.length ? (
          <button onClick={generate} disabled={!regularComplete || league.players.length < league.playoff.qualifierCount} className="shrink-0 rounded-xl bg-violet-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            Generate playoffs
          </button>
        ) : null}
      </div>

      {!regularComplete ? <p className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm font-bold text-slate-400">Finish the regular season to unlock the playoff bracket.</p> : null}
      {regularComplete && league.players.length < league.playoff.qualifierCount ? <p className="mt-5 rounded-2xl bg-amber-400/10 p-4 text-sm font-bold text-amber-200">Add at least {league.playoff.qualifierCount} players before generating fixtures for this playoff size.</p> : null}

      {league.playoff.rounds.length ? (
        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          {league.playoff.rounds.map((round) => (
            <div key={round.id}>
              <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-violet-200">{round.name}</h3>
              <div className="space-y-3">
                {round.matches.map((match) => <PlayoffMatchRow key={match.id} league={league} match={match} admin={admin} onChange={onChange} />)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PlayoffMatchRow({ league, match, admin, onChange }: { league: League; match: LeaguePlayoffMatch; admin: boolean; onChange?: (league: League) => void }) {
  const [score1, setScore1] = useState(match.score1 ?? 0);
  const [score2, setScore2] = useState(match.score2 ?? 0);
  const ready = Boolean(match.player1Id && match.player2Id);

  function save() {
    const validation = validateLeagueResult(league.raceTo, score1, score2);
    if (validation) return window.alert(validation);
    const updated = saveLeaguePlayoffResult(league.id, match.id, score1, score2);
    if (updated) onChange?.(updated);
  }

  function reset() {
    const updated = resetLeaguePlayoffResult(league.id, match.id);
    if (updated) onChange?.(updated);
  }

  return (
    <div className="rounded-2xl border border-violet-300/15 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3 text-sm font-black text-white">
        <span className="truncate">{match.seed1 ? `${match.seed1}. ` : ""}{getPlayerName(league, match.player1Id)}</span>
        <span>{match.completed ? match.score1 : "–"}</span>
      </div>
      <div className="my-3 h-px bg-white/10" />
      <div className="flex items-center justify-between gap-3 text-sm font-black text-white">
        <span className="truncate">{match.seed2 ? `${match.seed2}. ` : ""}{getPlayerName(league, match.player2Id)}</span>
        <span>{match.completed ? match.score2 : "–"}</span>
      </div>
      {admin && ready ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input type="number" min={0} max={league.raceTo} value={score1} onChange={(event) => setScore1(Number(event.target.value))} className="w-14 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-center font-black" />
          <span className="text-slate-500">–</span>
          <input type="number" min={0} max={league.raceTo} value={score2} onChange={(event) => setScore2(Number(event.target.value))} className="w-14 rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-center font-black" />
          <button onClick={save} className="rounded-lg bg-violet-300 px-3 py-2 text-xs font-black text-slate-950">Save</button>
          {match.completed ? <button onClick={reset} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300">Reset</button> : null}
        </div>
      ) : null}
    </div>
  );
}
