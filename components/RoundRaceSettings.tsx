"use client";

import { useMemo, useState } from "react";

import {
  getMatchRaceTo,
  getTournamentRaceGroups,
  raceGroupHasPlayedActivity,
  setTournamentMatchesRaceTo,
} from "@/lib/tournament-races";
import { type Tournament, updateTournament } from "@/lib/tournaments";

export function RoundRaceSettings({ tournament, onTournamentChange }: { tournament: Tournament; onTournamentChange: (tournament: Tournament) => void }) {
  const groups = useMemo(() => getTournamentRaceGroups(tournament), [tournament]);
  const [message, setMessage] = useState("");
  if (!groups.length) return null;

  function save(groupId: string, raceTo: number) {
    const group = groups.find((item) => item.id === groupId);
    if (!group || raceGroupHasPlayedActivity(group)) return;
    const structures = setTournamentMatchesRaceTo(tournament, group.matches.map((match) => match.id), raceTo);
    const updated = updateTournament(tournament.id, structures);
    if (!updated) {
      setMessage("That round’s race could not be saved.");
      return;
    }
    setMessage(`${group.label} is now Race to ${Math.max(1, Math.min(50, Math.floor(raceTo)))}.`);
    onTournamentChange(updated);
  }

  return (
    <details className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4 sm:p-5">
      <summary className="cursor-pointer list-none font-black text-cyan-100">
        <span className="flex items-center justify-between gap-3"><span>Race settings by round</span><span className="text-sm font-bold text-slate-400">Opening rounds · Finals</span></span>
      </summary>
      <div className="mt-5 border-t border-white/10 pt-5">
        <p className="text-sm leading-6 text-slate-400">Set a different target for each phase. Once a playable match in that phase starts, its race is locked to protect recorded scores.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => {
            const locked = raceGroupHasPlayedActivity(group);
            const currentRace = getMatchRaceTo(group.matches[0], tournament.raceTo);
            return (
              <label key={group.id} className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-sm font-bold text-slate-300">
                <span className="flex min-h-10 items-start justify-between gap-2"><span>{group.label}</span>{locked ? <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase text-slate-400">Locked</span> : null}</span>
                <span className="mt-2 flex items-center gap-2"><span className="shrink-0 text-xs text-slate-400">Race to</span><input key={`${group.id}:${currentRace}`} type="number" min={1} max={50} defaultValue={currentRace} disabled={locked} onBlur={(event) => { const next = Number(event.target.value); if (Number.isInteger(next) && next >= 1 && next <= 50 && next !== currentRace) save(group.id, next); }} className="min-h-10 w-full rounded-lg border border-white/10 bg-slate-900 px-3 font-black text-white outline-none focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-50" /></span>
              </label>
            );
          })}
        </div>
        {message ? <p className="mt-4 text-sm font-bold text-emerald-300">{message}</p> : null}
      </div>
    </details>
  );
}
