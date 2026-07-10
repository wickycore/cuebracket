"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { deleteTournament, getTournament, Tournament, updateTournament } from "@/lib/tournaments";

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const found = getTournament(params.id);
    if (!found) {
      setMissing(true);
      return;
    }
    setTournament(found);
  }, [params.id]);

  function changeStatus(status: Tournament["status"]) {
    const updated = updateTournament(params.id, { status });
    if (updated) setTournament(updated);
  }

  function handleDelete() {
    if (!tournament) return;
    const shouldDelete = window.confirm(`Delete “${tournament.name}”?`);
    if (!shouldDelete) return;

    deleteTournament(tournament.id);
    router.push("/dashboard");
  }

  if (missing) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <AppHeader />
        <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
          <div className="text-5xl">🎱</div>
          <h1 className="mt-6 text-3xl font-black">Tournament not found</h1>
          <p className="mt-3 text-slate-400">It may have been deleted from this browser.</p>
          <Link href="/dashboard" className="mt-7 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">
            Return to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!tournament) {
    return <main className="min-h-screen bg-slate-950" />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AppHeader />
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold capitalize text-cyan-300 ring-1 ring-cyan-400/20">
                {tournament.status}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400 ring-1 ring-white/10">
                {tournament.format === "single" ? "Single life" : "Double life"}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{tournament.name}</h1>
            <p className="mt-3 text-slate-400">{tournament.venue || "Venue not set"}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tournament.status !== "live" ? (
              <button onClick={() => changeStatus("live")} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300">
                Start Tournament
              </button>
            ) : null}
            {tournament.status !== "completed" ? (
              <button onClick={() => changeStatus("completed")} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/5 hover:text-white">
                Mark Completed
              </button>
            ) : null}
            <button onClick={handleDelete} className="rounded-xl border border-rose-400/20 px-4 py-3 text-sm font-bold text-rose-300 hover:bg-rose-400/10">
              Delete
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Format", tournament.format === "single" ? "Single life" : "Double life"],
            ["Race to", tournament.raceTo],
            ["Bracket size", tournament.bracketSize],
            ["Players", tournament.players.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-sm font-bold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-16 text-center">
          <div className="text-4xl">👥</div>
          <h2 className="mt-5 text-2xl font-black">Player management comes next</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-400">
            Phase 3 will add player entry, remove, randomize, seed and import tools before bracket generation.
          </p>
        </div>
      </div>
    </main>
  );
}
