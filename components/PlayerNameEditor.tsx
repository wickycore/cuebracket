"use client";

import { useState, type FormEvent } from "react";

import {
  renameTournamentPlayer,
  type Tournament,
  updateTournament,
} from "@/lib/tournaments";

export function PlayerNameEditor({
  tournament,
  onTournamentChange,
}: {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(tournament.players[0] ?? "");
  const [newName, setNewName] = useState(tournament.players[0] ?? "");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const activePlayer = tournament.players.includes(selectedPlayer)
    ? selectedPlayer
    : tournament.players[0] ?? "";
  const activeName = tournament.players.includes(selectedPlayer)
    ? newName
    : activePlayer;

  function choosePlayer(player: string) {
    setSelectedPlayer(player);
    setNewName(player);
    setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const result = renameTournamentPlayer(tournament, activePlayer, activeName);
    if (!result.ok) {
      setIsError(true);
      setMessage(result.reason);
      return;
    }

    const correctedName = activeName.trim().replace(/\s+/g, " ");
    const updated = updateTournament(tournament.id, result.updates);
    if (!updated) {
      setIsError(true);
      setMessage("The name could not be updated.");
      return;
    }

    setSelectedPlayer(correctedName);
    setNewName(correctedName);
    setIsError(false);
    setMessage("Name updated everywhere without changing the draw.");
    onTournamentChange(updated);
  }

  if (!tournament.players.length) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Correct player name</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">Fix a spelling mistake after the draw. Match positions, results and progression stay unchanged.</p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="grid gap-2 text-xs font-bold text-slate-400">
          PLAYER
          <select
            value={activePlayer}
            onChange={(event) => choosePlayer(event.target.value)}
            className="h-12 min-w-0 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white"
          >
            {tournament.players.map((player) => <option key={player} value={player}>{player}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-bold text-slate-400">
          CORRECTED NAME
          <input
            value={activeName}
            onChange={(event) => setNewName(event.target.value)}
            className="h-12 min-w-0 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-cyan-400/50"
          />
        </label>
        <button type="submit" className="h-12 self-end rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 hover:bg-cyan-300">Update name</button>
      </form>
      {message ? (
        <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${isError ? "bg-rose-400/10 text-rose-200" : "bg-emerald-400/10 text-emerald-200"}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
