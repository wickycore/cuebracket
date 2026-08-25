"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { BracketManager } from "@/components/BracketManager";
import { CompetitionManager } from "@/components/CompetitionManager";
import { LiveMatchCenter } from "@/components/LiveMatchCenter";
import { PlayerManager } from "@/components/PlayerManager";
import { ShareTournament } from "@/components/ShareTournament";
import { TournamentStats } from "@/components/TournamentStats";
import {
  deleteTournament,
  getFormatLabel,
  getTournament,
  getTournamentChampion,
  getTournamentTypeLabel,
  hasTournamentStructure,
  subscribeToTournamentChanges,
  type Tournament,
  updateTournament,
} from "@/lib/tournaments";

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [missing, setMissing] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState("");

  useEffect(() => {
    const load = () => {
      const found = getTournament(params.id);
      if (!found) {
        setMissing(true);
        return;
      }
      setMissing(false);
      setTournament(found);
    };

    load();
    return subscribeToTournamentChanges(load);
  }, [params.id]);

  function changeStatus(status: Tournament["status"]) {
    const updated = updateTournament(params.id, { status });
    if (updated) setTournament(updated);
  }

  function handleDelete() {
    if (!tournament || !window.confirm(`Delete “${tournament.name}”?`)) return;
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
          <p className="mt-3 text-slate-400">
            It may have been deleted from this browser.
          </p>
          <a data-cb-hard-navigation="true"
            href="/dashboard"
            className="mt-7 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950"
          >
            Return to dashboard
          </a>
        </div>
      </main>
    );
  }

  if (!tournament) return <main className="min-h-screen bg-slate-950" />;

  const elimination =
    tournament.type === "single_stage" &&
    (tournament.format === "single" || tournament.format === "double");
  const structureReady = hasTournamentStructure(tournament);
  const champion = getTournamentChampion(tournament);

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
                {getFormatLabel(tournament.format)}
              </span>
              <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs text-violet-300 ring-1 ring-violet-400/20">
                {getTournamentTypeLabel(tournament.type)}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              {tournament.name}
            </h1>
            <p className="mt-3 text-slate-400">
              {tournament.venue || "Venue not set"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tournament.status === "draft" && structureReady && !champion ? (
              <button
                onClick={() => changeStatus("live")}
                className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950"
              >
                Start Tournament
              </button>
            ) : null}

            {!elimination &&
            tournament.status === "live" &&
            structureReady &&
            !champion ? (
              <button
                onClick={() => changeStatus("completed")}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300"
              >
                Mark Completed
              </button>
            ) : null}

            {!elimination && tournament.status === "completed" ? (
              <button
                onClick={() => changeStatus("live")}
                className="rounded-xl border border-amber-300/25 px-4 py-3 text-sm font-bold text-amber-200 hover:bg-amber-300/10"
              >
                Reopen tournament
              </button>
            ) : null}

            <details className="relative">
              <summary className="grid h-12 w-12 cursor-pointer list-none place-items-center rounded-xl border border-white/10 text-xl font-black text-slate-300 hover:bg-white/5">•••</summary>
              <div className="absolute right-0 z-30 mt-2 min-w-48 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
                <button onClick={handleDelete} className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-300 hover:bg-rose-400/10">Delete tournament</button>
              </div>
            </details>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:grid-cols-4">
          {[
            [
              "Format",
              tournament.type === "two_stage"
                ? "Groups → Finals"
                : getFormatLabel(tournament.format),
            ],
            [
              tournament.format === "free_for_all" ? "Score cap" : "Race to",
              tournament.raceTo,
            ],
            ["Capacity", tournament.bracketSize],
            ["Players", tournament.players.length],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-b border-r border-white/10 p-4 last:border-r-0 sm:border-b-0"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-black">{value}</p>
            </div>
          ))}
        </div>

        {!structureReady ? (
          <PlayerManager
            tournament={tournament}
            onTournamentChange={setTournament}
          />
        ) : null}

        {elimination && tournament.bracket ? (
          <div className="mt-6">
            <LiveMatchCenter
              tournament={tournament}
              onTournamentChange={setTournament}
              selectedMatchId={selectedMatchId}
              onSelectedMatchChange={setSelectedMatchId}
            />
          </div>
        ) : null}

        {elimination ? (
          <div className="mt-6">
            <BracketManager
              tournament={tournament}
              onTournamentChange={setTournament}
              selectedMatchId={selectedMatchId}
              onSelectMatch={setSelectedMatchId}
            />
          </div>
        ) : (
          <CompetitionManager
            tournament={tournament}
            onTournamentChange={setTournament}
          />
        )}

        {structureReady ? <TournamentStats tournament={tournament} /> : null}
        {structureReady ? (
          <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
            <summary className="cursor-pointer list-none font-black text-slate-200">
              <span className="flex items-center justify-between gap-3"><span>Share tournament</span><span className="text-sm font-bold text-slate-500">Link · Social · QR</span></span>
            </summary>
            <div className="mt-4 border-t border-white/10 pt-1">
              <ShareTournament tournament={tournament} />
            </div>
          </details>
        ) : null}
      </div>
    </main>
  );
}
