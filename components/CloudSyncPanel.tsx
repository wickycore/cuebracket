"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getTournaments, Tournament } from "@/lib/tournaments";
import {
  CloudTournamentRow,
  getMyCloudTournaments,
  syncTournamentToCloud,
} from "@/lib/cloud/tournaments";

export function CloudSyncPanel() {
  const [local, setLocal] = useState<Tournament[]>([]);
  const [cloud, setCloud] = useState<CloudTournamentRow[]>([]);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function loadCloud() {
    try {
      setCloud(await getMyCloudTournaments());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load cloud tournaments.");
    }
  }

  useEffect(() => {
    setLocal(getTournaments());
    void loadCloud();
  }, []);

  async function sync(tournament: Tournament) {
    setBusyId(tournament.id);
    setMessage("");

    try {
      await syncTournamentToCloud(tournament);
      setMessage(`${tournament.name} is now live in the cloud.`);
      await loadCloud();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
        Cloud synchronization
      </p>
      <h2 className="mt-2 text-2xl font-black text-white">
        Publish local tournaments.
      </h2>
      <p className="mt-2 text-slate-400">
        Upload a tournament once, then use its cloud live link on any device.
      </p>

      {message ? (
        <p className="mt-4 rounded-xl bg-cyan-400/10 p-3 text-sm font-bold text-cyan-200">
          {message}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {local.length ? (
          local.map((tournament) => {
            const exists = cloud.some((item) => item.id === tournament.id);
            return (
              <article
                key={tournament.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-black text-white">{tournament.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {tournament.players.length} players · {tournament.status}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => sync(tournament)}
                    disabled={busyId === tournament.id}
                    className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    {busyId === tournament.id
                      ? "Syncing..."
                      : exists
                        ? "Update cloud"
                        : "Publish to cloud"}
                  </button>

                  {exists ? (
                    <Link
                      href={`/cloud/live/${tournament.id}`}
                      target="_blank"
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300"
                    >
                      Open live link
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">
            No local tournaments found.
          </p>
        )}
      </div>
    </section>
  );
}
