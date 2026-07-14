"use client";

import { FormEvent, useMemo, useState } from "react";
import { Tournament, updateTournament } from "@/lib/tournaments";

interface PlayerManagerProps {
  tournament: Tournament;
  onTournamentChange: (tournament: Tournament) => void;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

export function PlayerManager({ tournament, onTournamentChange }: PlayerManagerProps) {
  const [name, setName] = useState("");
  const [bulkNames, setBulkNames] = useState("");
  const [error, setError] = useState("");

  const remaining = tournament.bracketSize - tournament.players.length;
  const duplicateNames = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    tournament.players.forEach((player) => {
      const normalized = player.trim().toLowerCase();
      if (seen.has(normalized)) duplicates.add(normalized);
      seen.add(normalized);
    });

    return duplicates;
  }, [tournament.players]);

  function savePlayers(players: string[]) {
    const updated = updateTournament(tournament.id, { players });
    if (updated) onTournamentChange(updated);
  }

  function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Enter a player name.");
      return;
    }

    if (tournament.players.length >= tournament.bracketSize) {
      setError(`This event is full at ${tournament.bracketSize} players.`);
      return;
    }

    if (tournament.players.some((player) => player.toLowerCase() === cleanName.toLowerCase())) {
      setError("That player is already in the tournament.");
      return;
    }

    savePlayers([...tournament.players, cleanName]);
    setName("");
  }

  function importPlayers() {
    setError("");

    const imported = bulkNames
      .split(/[\n,;]/)
      .map((player) => player.trim())
      .filter(Boolean);

    if (imported.length === 0) {
      setError("Paste at least one player name.");
      return;
    }

    const existing = new Set(tournament.players.map((player) => player.toLowerCase()));
    const uniqueImported: string[] = [];

    imported.forEach((player) => {
      const normalized = player.toLowerCase();
      if (!existing.has(normalized)) {
        existing.add(normalized);
        uniqueImported.push(player);
      }
    });

    const availableSlots = tournament.bracketSize - tournament.players.length;
    const accepted = uniqueImported.slice(0, availableSlots);

    if (accepted.length === 0) {
      setError("No new players were added. Check duplicates or bracket capacity.");
      return;
    }

    savePlayers([...tournament.players, ...accepted]);
    setBulkNames("");

    if (accepted.length < uniqueImported.length) {
      setError(`${accepted.length} players added. The rest did not fit within the event capacity.`);
    }
  }

  function removePlayer(index: number) {
    savePlayers(tournament.players.filter((_, playerIndex) => playerIndex !== index));
  }

  function movePlayer(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= tournament.players.length) return;

    const players = [...tournament.players];
    [players[index], players[targetIndex]] = [players[targetIndex], players[index]];
    savePlayers(players);
  }

  function clearPlayers() {
    if (tournament.players.length === 0) return;
    if (!window.confirm("Remove every player from this tournament?")) return;
    savePlayers([]);
  }

  return (
    <section className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">Player list</p>
            <h2 className="mt-2 text-2xl font-black">Seeds and participants</h2>
            <p className="mt-2 text-sm text-slate-400">
              The number beside each name is the current seed. Move players manually or randomize the entire draw.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => savePlayers(shuffle(tournament.players))}
              disabled={tournament.players.length < 2}
              className="rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              🎲 Randomize
            </button>
            <button
              type="button"
              onClick={clearPlayers}
              disabled={tournament.players.length === 0}
              className="rounded-xl border border-rose-400/20 px-4 py-2.5 text-sm font-bold text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        </div>

        <form onSubmit={addPlayer} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter player name"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3.5 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          />
          <button
            type="submit"
            disabled={remaining <= 0}
            className="rounded-2xl bg-cyan-400 px-5 py-3.5 font-black text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Add player
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-2xl bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200 ring-1 ring-amber-400/20">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
          {tournament.players.length > 0 ? (
            tournament.players.map((player, index) => (
              <div
                key={`${player}-${index}`}
                className="flex items-center gap-3 border-b border-white/10 bg-slate-950/35 px-4 py-3 last:border-b-0"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-sm font-black text-cyan-300 ring-1 ring-cyan-400/20">
                  {index + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate font-bold ${duplicateNames.has(player.toLowerCase()) ? "text-amber-300" : "text-white"}`}>
                  {player}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => movePlayer(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${player} up`}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-20"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => movePlayer(index, 1)}
                    disabled={index === tournament.players.length - 1}
                    aria-label={`Move ${player} down`}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-20"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removePlayer(index)}
                    aria-label={`Remove ${player}`}
                    className="grid h-9 w-9 place-items-center rounded-lg text-rose-300 hover:bg-rose-400/10"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center">
              <div className="text-4xl">👥</div>
              <p className="mt-4 font-black text-white">No players added yet</p>
              <p className="mt-1 text-sm text-slate-500">Add one name above or import several names at once.</p>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">Capacity</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-black text-white">{tournament.players.length}</p>
              <p className="text-sm text-slate-500">of {tournament.bracketSize} capacity</p>
            </div>
            <p className="rounded-full bg-white/5 px-3 py-1 text-sm font-bold text-slate-300 ring-1 ring-white/10">
              {remaining} slots left
            </p>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-950/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all"
              style={{ width: `${Math.min(100, (tournament.players.length / tournament.bracketSize) * 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-400">Bulk import</p>
          <h3 className="mt-2 text-xl font-black text-white">Paste many names</h3>
          <p className="mt-2 text-sm text-slate-400">Separate names using new lines, commas or semicolons.</p>
          <textarea
            value={bulkNames}
            onChange={(event) => setBulkNames(event.target.value)}
            placeholder={"Wicky\nBen\nGM\nSam"}
            rows={7}
            className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          />
          <button
            type="button"
            onClick={importPlayers}
            disabled={!bulkNames.trim() || remaining <= 0}
            className="mt-3 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 font-black text-cyan-200 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Import names
          </button>
        </div>
      </aside>
    </section>
  );
}
