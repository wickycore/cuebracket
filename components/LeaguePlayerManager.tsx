"use client";

import { FormEvent, useState } from "react";
import {
  addLeaguePlayer,
  addManyLeaguePlayers,
  League,
  removeLeaguePlayer,
} from "@/lib/leagues";

interface Props {
  league: League;
  onChange: (league: League) => void;
}

export function LeaguePlayerManager({ league, onChange }: Props) {
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");

  function addOne(event: FormEvent) {
    event.preventDefault();
    const updated = addLeaguePlayer(league.id, name);
    if (updated) onChange(updated);
    setName("");
  }

  function addMany() {
    const updated = addManyLeaguePlayers(
      league.id,
      bulk.split(/[\n,]+/).map((item) => item.trim()),
    );
    if (updated) onChange(updated);
    setBulk("");
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Players</p>
        <h2 className="mt-2 text-2xl font-black text-white">League participants</h2>
        <p className="mt-2 text-slate-400">Changing players clears existing fixtures so the schedule stays correct.</p>
      </div>

      <form onSubmit={addOne} className="mt-5 flex gap-3">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Player name"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
        />
        <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Add</button>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          placeholder={"Paste names separated by new lines or commas"}
          rows={4}
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none"
        />
        <button
          type="button"
          onClick={addMany}
          className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-200"
        >
          Import names
        </button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {league.players.map((player, index) => (
          <div key={player.id} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-4 py-3">
            <span className="font-bold text-white">{index + 1}. {player.name}</span>
            <button
              onClick={() => {
                const updated = removeLeaguePlayer(league.id, player.id);
                if (updated) onChange(updated);
              }}
              className="text-sm font-bold text-rose-300"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
