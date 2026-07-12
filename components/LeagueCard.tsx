"use client";

import Link from "next/link";
import { deleteLeague, duplicateLeague, League } from "@/lib/leagues";

interface Props {
  league: League;
  onChange: () => void;
}

const statusStyles: Record<League["status"], string> = {
  draft: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  live: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  completed: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
};

export function LeagueCard({ league, onChange }: Props) {
  function handleDelete() {
    if (!window.confirm(`Delete “${league.name}”? This cannot be undone.`)) return;
    deleteLeague(league.id);
    onChange();
  }

  function handleDuplicate() {
    duplicateLeague(league.id);
    onChange();
  }

  const completed = league.fixtures.filter((fixture) => fixture.completed).length;

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-black/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ring-1 ${statusStyles[league.status]}`}>
          {league.status}
        </span>
        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300 ring-1 ring-cyan-400/20">
          {league.season || "Season not set"}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-black text-white">{league.name}</h3>
      <p className="mt-1 text-sm text-slate-400">{league.venue || "Venue not set"}</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-950/60 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Players</p>
          <p className="mt-1 text-lg font-black text-white">{league.players.length}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Fixtures</p>
          <p className="mt-1 text-lg font-black text-white">{league.fixtures.length}</p>
        </div>
        <div className="rounded-2xl bg-slate-950/60 p-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">Played</p>
          <p className="mt-1 text-lg font-black text-white">{completed}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/leagues/${league.id}`} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950">
          Manage
        </Link>
        <Link href={`/league/${league.id}`} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-200">
          Public view
        </Link>
        <button onClick={handleDuplicate} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300">
          Duplicate
        </button>
        <button onClick={handleDelete} className="rounded-xl border border-rose-400/20 px-4 py-2 text-sm font-bold text-rose-300">
          Delete
        </button>
      </div>
    </article>
  );
}
