"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  addLeaguePlayer,
  addManyLeaguePlayers,
  addRegisteredLeaguePlayer,
  removeLeaguePlayer,
  type League,
} from "@/lib/leagues";
import {
  findRegisteredPlayer,
  getClubLeagueRoster,
  type RegisteredPlayerProfile,
} from "@/lib/cloud/leagues";

interface Props {
  league: League;
  onChange: (league: League) => void;
}

function profileName(profile: RegisteredPlayerProfile) {
  return profile.tournament_name || profile.display_name;
}

export function LeaguePlayerManager({ league, onChange }: Props) {
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [username, setUsername] = useState("");
  const [roster, setRoster] = useState<RegisteredPlayerProfile[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    if (!league.clubId) return;
    void getClubLeagueRoster(league.clubId)
      .then((players) => { if (active) setRoster(players); })
      .catch(() => { if (active) setRoster([]); });
    return () => { active = false; };
  }, [league.clubId]);

  const availableRoster = useMemo(() => {
    const added = new Set(league.players.map((player) => player.profileId).filter(Boolean));
    return roster.filter((profile) => !added.has(profile.id));
  }, [league.players, roster]);

  function addOne(event: FormEvent) {
    event.preventDefault();
    const updated = addLeaguePlayer(league.id, name);
    if (updated) onChange(updated);
    setName("");
  }

  function addMany() {
    const updated = addManyLeaguePlayers(league.id, bulk.split(/[\n,]+/).map((item) => item.trim()));
    if (updated) onChange(updated);
    setBulk("");
  }

  function addProfile(profile: RegisteredPlayerProfile) {
    const updated = addRegisteredLeaguePlayer(league.id, {
      profileId: profile.id,
      name: profileName(profile),
      username: profile.username,
    });
    if (updated) onChange(updated);
    setMessage(`${profileName(profile)} added as a registered player.`);
  }

  async function addByUsername(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const profile = await findRegisteredPlayer(username);
      addProfile(profile);
      setUsername("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Player lookup failed.");
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Season roster</p>
        <h2 className="mt-2 text-2xl font-black text-white">League participants</h2>
        <p className="mt-2 text-slate-400">Registered profiles stay linked to their identity and club. Changing the roster safely clears the current schedule.</p>
      </div>

      {league.clubId && availableRoster.length ? (
        <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4">
          <p className="text-sm font-black text-cyan-200">Add from club roster</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {availableRoster.map((profile) => (
              <button key={profile.id} onClick={() => addProfile(profile)} className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-left text-sm font-bold text-white">
                + {profileName(profile)} {profile.username ? <span className="text-slate-400">@{profile.username}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={addByUsername} className="mt-5 flex gap-3">
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Registered username, e.g. @wicky" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none" />
        <button className="rounded-xl border border-cyan-400/30 px-5 py-3 font-black text-cyan-200">Find & add</button>
      </form>
      {message ? <p className="mt-2 text-sm font-bold text-slate-400">{message}</p> : null}

      <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-white/10" />Guest players<span className="h-px flex-1 bg-white/10" /></div>
      <form onSubmit={addOne} className="flex gap-3">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Guest player name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none" />
        <button className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Add</button>
      </form>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder="Paste guest names separated by new lines or commas" rows={4} className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none" />
        <button type="button" onClick={addMany} className="rounded-xl border border-white/10 px-5 py-3 font-bold text-slate-200">Import names</button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {league.players.map((player, index) => (
          <div key={player.id} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-4 py-3">
            <span className="min-w-0 truncate font-bold text-white">{index + 1}. {player.name} {player.username ? <span className="text-xs text-cyan-300">@{player.username}</span> : <span className="text-xs text-slate-400">guest</span>}</span>
            <button onClick={() => { const updated = removeLeaguePlayer(league.id, player.id); if (updated) onChange(updated); }} className="ml-3 text-sm font-bold text-rose-300">Remove</button>
          </div>
        ))}
      </div>
    </section>
  );
}
