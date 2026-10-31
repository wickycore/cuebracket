"use client";

import { useState, type FormEvent } from "react";
import { updateLeague, type League } from "@/lib/leagues";

export function LeagueNameEditor({ league, onChange }: { league: League; onChange: (league: League) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(league.name);
  const [error, setError] = useState("");

  function save(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (clean.length < 3) {
      setError("League name must contain at least 3 characters.");
      return;
    }
    try {
      const updated = updateLeague(league.id, { name: clean });
      if (!updated) {
        setError("League not found. Refresh the page and try again.");
        return;
      }
      onChange(updated);
      setEditing(false);
      setError("");
    } catch {
      setError("Unable to save the name. Please try again.");
    }
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="min-w-0 break-words text-4xl font-black">{league.name}</h1>
        <button type="button" onClick={() => { setName(league.name); setError(""); setEditing(true); }} className="min-h-11 shrink-0 px-1 text-sm font-bold text-cyan-300">Edit name</button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-4 max-w-xl">
      <label htmlFor="league-name" className="block text-sm font-bold text-slate-300">League name</label>
      <input id="league-name" autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(""); }} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} aria-invalid={Boolean(error)} aria-describedby={error ? "league-name-error" : undefined} className="mt-2 block min-h-11 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 font-bold text-white" />
      {error ? <p id="league-name-error" role="alert" className="mt-2 text-sm text-rose-300">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="submit" className="min-h-11 rounded-lg bg-cyan-400 px-4 text-sm font-black text-slate-950">Save name</button>
        <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-lg border border-white/10 px-4 text-sm font-bold text-slate-300">Cancel</button>
      </div>
    </form>
  );
}
