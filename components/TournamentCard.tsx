"use client";

import Link from "next/link";
import {
  Tournament,
  deleteTournament,
  duplicateTournament,
  getAllMatches,
  getFormatLabel,
  getTournamentEventCounts,
  hasTournamentStructure,
} from "@/lib/tournaments";

interface TournamentCardProps {
  tournament: Tournament;
  onChange: () => void;
  compact?: boolean;
}

const statusStyles: Record<Tournament["status"], string> = {
  draft: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
  live: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  completed: "bg-slate-400/10 text-slate-300 ring-slate-400/20",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function TournamentCard({
  tournament,
  onChange,
  compact = false,
}: TournamentCardProps) {
  const eventCounts = getTournamentEventCounts(tournament);
  const completed = eventCounts.completed;
  const liveMatches = getAllMatches(tournament).filter((match) => match.status === "live" && !match.completed).length;
  const progress = eventCounts.total ? Math.round((completed / eventCounts.total) * 100) : 0;
  const structureReady = hasTournamentStructure(tournament);
  const availableSeats = Math.max(0, tournament.bracketSize - tournament.players.length);

  function handleDelete() {
    const shouldDelete = window.confirm(
      `Delete “${tournament.name}”? This cannot be undone.`,
    );
    if (!shouldDelete) return;

    deleteTournament(tournament.id);
    onChange();
  }

  function handleDuplicate() {
    duplicateTournament(tournament.id);
    onChange();
  }

  const primaryLabel =
    tournament.status === "draft"
      ? structureReady
        ? "Continue setup"
        : "Set up event"
      : tournament.status === "live"
        ? "Open control room"
        : "View results";

  return (
    <article className="cb-card cb-card-hover group relative overflow-hidden rounded-[2rem] p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-cyan-400/[0.04] blur-3xl transition group-hover:bg-cyan-400/[0.08]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[0.68rem] font-black uppercase tracking-wider ring-1 ${statusStyles[tournament.status]}`}
              >
                {tournament.status === "live" ? <span className="cb-live-dot" /> : null}
                {tournament.status}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-[0.68rem] font-bold text-slate-400 ring-1 ring-white/10">
                {tournament.type === "two_stage" ? "Groups → Finals" : getFormatLabel(tournament.format)}
              </span>
            </div>

            <h2 className="truncate text-xl font-black tracking-tight text-white sm:text-2xl">
              {tournament.name}
            </h2>
            <p className="mt-1 flex items-center gap-2 truncate text-sm text-slate-400">
              <span className="text-slate-600">⌖</span>
              {tournament.venue || "Venue not set"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/10 text-lg font-black text-cyan-200 ring-1 ring-cyan-400/20">
              {tournament.players.length}
            </span>
            <p className="mt-1 text-[0.62rem] font-black uppercase tracking-wider text-slate-600">
              Players
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-500">Tournament progress</span>
            <span className="font-black text-slate-300">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/75 ring-1 ring-white/5">
            <div
              className={`h-full rounded-full transition-all ${
                tournament.status === "completed"
                  ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
                  : "bg-gradient-to-r from-cyan-400 to-blue-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[0.68rem] text-slate-600">
            <span>{completed} of {eventCounts.total || "—"} events</span>
            <span>{liveMatches ? `${liveMatches} playing now` : `Updated ${formatDate(tournament.updatedAt)}`}</span>
          </div>
        </div>

        {!compact ? (
          <dl className="mt-5 grid grid-cols-3 gap-2.5 text-sm">
            <div className="rounded-2xl border border-white/5 bg-slate-950/45 p-3.5">
              <dt className="text-[0.66rem] font-black uppercase tracking-wider text-slate-600">Race</dt>
              <dd className="mt-1 font-black text-white">To {tournament.raceTo}</dd>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/45 p-3.5">
              <dt className="text-[0.66rem] font-black uppercase tracking-wider text-slate-600">Bracket</dt>
              <dd className="mt-1 font-black text-white">{tournament.bracketSize}</dd>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/45 p-3.5">
              <dt className="text-[0.66rem] font-black uppercase tracking-wider text-slate-600">Open spots</dt>
              <dd className="mt-1 font-black text-white">{availableSeats}</dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/tournaments/${tournament.id}`}
            className="min-w-0 flex-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-center text-sm font-black text-slate-950 transition hover:bg-cyan-300"
          >
            {primaryLabel}
          </Link>

          {structureReady ? (
            <Link
              href={`/live/${tournament.id}`}
              title="Open spectator view"
              className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-3.5 py-2.5 text-sm font-black text-cyan-200 transition hover:bg-cyan-400/10"
            >
              Live ↗
            </Link>
          ) : null}

          {!compact ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-black text-slate-400 transition hover:bg-white/5 hover:text-white">
                •••
              </summary>
              <div className="absolute bottom-12 right-0 z-20 w-40 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-1.5 shadow-2xl shadow-black/50">
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  Duplicate event
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-300 hover:bg-rose-400/10"
                >
                  Delete event
                </button>
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </article>
  );
}
