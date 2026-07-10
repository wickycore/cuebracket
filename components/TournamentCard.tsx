"use client";

import Link from "next/link";
import { Tournament, deleteTournament, duplicateTournament } from "@/lib/tournaments";

interface TournamentCardProps {
  tournament: Tournament;
  onChange: () => void;
}

const statusStyles: Record<Tournament["status"], string> = {
  draft: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  live: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  completed: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
};

export function TournamentCard({ tournament, onChange }: TournamentCardProps) {
  function handleDelete() {
    const shouldDelete = window.confirm(`Delete “${tournament.name}”? This cannot be undone.`);
    if (!shouldDelete) return;

    deleteTournament(tournament.id);
    onChange();
  }

  function handleDuplicate() {
    duplicateTournament(tournament.id);
    onChange();
  }

  return (
    <article className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/10 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ${statusStyles[tournament.status]}`}>
              {tournament.status}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400 ring-1 ring-white/10">
              {tournament.format === "single" ? "Single life" : "Double life"}
            </span>
          </div>

          <h2 className="text-xl font-black text-white">{tournament.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{tournament.venue || "Venue not set"}</p>
        </div>

        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-400/10 text-lg font-black text-cyan-300 ring-1 ring-cyan-400/20">
          {tournament.players.length}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-950/50 p-3">
          <dt className="text-slate-500">Race to</dt>
          <dd className="mt-1 font-bold text-white">{tournament.raceTo}</dd>
        </div>
        <div className="rounded-2xl bg-slate-950/50 p-3">
          <dt className="text-slate-500">Bracket</dt>
          <dd className="mt-1 font-bold text-white">{tournament.bracketSize}</dd>
        </div>
        <div className="rounded-2xl bg-slate-950/50 p-3">
          <dt className="text-slate-500">Players</dt>
          <dd className="mt-1 font-bold text-white">{tournament.players.length}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/tournaments/${tournament.id}`}
          className="flex-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300"
        >
          Open
        </Link>
        <button
          type="button"
          onClick={handleDuplicate}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300 hover:border-white/20 hover:bg-white/5 hover:text-white"
        >
          Duplicate
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-xl border border-rose-400/20 px-4 py-2.5 text-sm font-bold text-rose-300 hover:bg-rose-400/10"
        >
          Delete
        </button>
      </div>
    </article>
  );
}
