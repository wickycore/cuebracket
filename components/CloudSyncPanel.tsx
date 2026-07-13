"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMyCloudTournaments,
  setCloudTournamentVisibility,
  type CloudTournamentRow,
} from "@/lib/cloud/tournaments";
import {
  subscribeToCloudSyncStatus,
  type CloudSyncStatusDetail,
} from "@/lib/cloud/sync-events";
import {
  getTournaments,
  subscribeToTournamentChanges,
  type Tournament,
} from "@/lib/tournaments";

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function CloudSyncPanel() {
  const [local, setLocal] = useState<Tournament[]>([]);
  const [cloud, setCloud] = useState<CloudTournamentRow[]>([]);
  const [statusById, setStatusById] = useState<Record<string, CloudSyncStatusDetail>>({});
  const [globalStatus, setGlobalStatus] = useState<CloudSyncStatusDetail | null>(null);
  const [message, setMessage] = useState("");
  const [visibilityBusyId, setVisibilityBusyId] = useState("");
  const [online, setOnline] = useState(true);

  const loadCloud = useCallback(async () => {
    try {
      setCloud(await getMyCloudTournaments());
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load cloud tournaments.",
      );
    }
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setLocal(getTournaments());
      setOnline(navigator.onLine);
      void loadCloud();
    }, 0);

    const unsubscribeLocal = subscribeToTournamentChanges(() => {
      setLocal(getTournaments());
    });

    const unsubscribeStatus = subscribeToCloudSyncStatus((detail) => {
      if (detail.tournamentId) {
        setStatusById((current) => ({
          ...current,
          [detail.tournamentId as string]: detail,
        }));
      } else {
        setGlobalStatus(detail);
      }

      if (detail.state === "synced" || detail.state === "deleted") {
        void loadCloud();
      }
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearTimeout(initialize);
      unsubscribeLocal();
      unsubscribeStatus();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadCloud]);

  const cloudById = useMemo(
    () => new Map(cloud.map((row) => [row.id, row])),
    [cloud],
  );

  async function toggleVisibility(row: CloudTournamentRow) {
    setVisibilityBusyId(row.id);
    setMessage("");

    try {
      const updated = await setCloudTournamentVisibility(row.id, !row.is_public);
      setCloud((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(
        updated.is_public
          ? `${updated.name} is now visible to spectators.`
          : `${updated.name} is now private. Its backup remains safe.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Visibility update failed.");
    } finally {
      setVisibilityBusyId("");
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            Automatic cloud backup
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Every tournament change saves itself.
          </h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            Scores, brackets, players and champions now sync automatically. Cloud
            tournaments are also restored onto another signed-in device.
          </p>
        </div>

        <div
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wider ${
            online
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              : "border-amber-400/20 bg-amber-400/10 text-amber-300"
          }`}
        >
          {online ? "● Auto-sync active" : "● Offline · queued"}
        </div>
      </div>

      {message || globalStatus?.message ? (
        <p className="mt-5 rounded-xl border border-cyan-400/10 bg-cyan-400/10 p-3 text-sm font-bold text-cyan-100">
          {message || globalStatus?.message}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {local.length ? (
          local.map((tournament) => {
            const cloudRow = cloudById.get(tournament.id);
            const syncStatus = statusById[tournament.id];
            const state = syncStatus?.state;
            const isWorking = state === "queued" || state === "syncing";
            const hasError = state === "error";

            return (
              <article
                key={tournament.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-black text-white">{tournament.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                        hasError
                          ? "bg-rose-400/10 text-rose-300"
                          : isWorking || !cloudRow
                            ? "bg-amber-400/10 text-amber-300"
                            : "bg-emerald-400/10 text-emerald-300"
                      }`}
                    >
                      {hasError
                        ? "Sync retrying"
                        : isWorking
                          ? state === "syncing"
                            ? "Saving..."
                            : "Queued"
                          : cloudRow
                            ? "Synced"
                            : "Preparing backup"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {tournament.players.length} players · {tournament.status}
                    {cloudRow ? ` · Cloud ${timeLabel(cloudRow.updated_at)}` : ""}
                  </p>

                  {hasError && syncStatus.message ? (
                    <p className="mt-2 text-xs font-semibold text-rose-300">
                      {syncStatus.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {cloudRow ? (
                    <button
                      type="button"
                      onClick={() => void toggleVisibility(cloudRow)}
                      disabled={visibilityBusyId === cloudRow.id}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-cyan-300/30 hover:text-white disabled:opacity-50"
                    >
                      {visibilityBusyId === cloudRow.id
                        ? "Saving..."
                        : cloudRow.is_public
                          ? "Make private"
                          : "Make public"}
                    </button>
                  ) : null}

                  {cloudRow?.is_public ? (
                    <Link
                      href={`/cloud/live/${tournament.id}`}
                      target="_blank"
                      className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-300"
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
            Create a tournament and it will appear here automatically.
          </p>
        )}
      </div>
    </section>
  );
}
