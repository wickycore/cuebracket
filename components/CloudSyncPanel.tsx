"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CloudTournamentOwnershipError,
  getMyCloudTournaments,
  setCloudTournamentVisibility,
  syncTournamentToCloud,
  type CloudTournamentRow,
} from "@/lib/cloud/tournaments";
import {
  subscribeToCloudSyncStatus,
  type CloudSyncStatusDetail,
} from "@/lib/cloud/sync-events";
import {
  getTournaments,
  saveTournaments,
  subscribeToTournamentChanges,
  type Tournament,
} from "@/lib/tournaments";

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function CloudSyncPanel() {
  const [local, setLocal] = useState<Tournament[]>([]);
  const [cloud, setCloud] = useState<CloudTournamentRow[]>([]);
  const [statusById, setStatusById] = useState<
    Record<string, CloudSyncStatusDetail>
  >({});
  const [globalStatus, setGlobalStatus] =
    useState<CloudSyncStatusDetail | null>(null);
  const [message, setMessage] = useState("");
  const [visibilityBusyId, setVisibilityBusyId] = useState("");
  const [online, setOnline] = useState(true);
  const [ownershipConflictIds, setOwnershipConflictIds] = useState<
    Record<string, boolean>
  >({});

  const mountedRef = useRef(true);
  const inFlightIds = useRef(new Set<string>());
  const automaticallyAttemptedIds = useRef(new Set<string>());

  const upsertCloudRow = useCallback((row: CloudTournamentRow) => {
    setCloud((current) => {
      const index = current.findIndex((item) => item.id === row.id);
      if (index === -1) return [row, ...current];

      const next = [...current];
      next[index] = row;
      return next;
    });
  }, []);

  const loadCloud = useCallback(async () => {
    try {
      const rows = await getMyCloudTournaments();
      if (mountedRef.current) {
        setCloud(rows);
        setMessage("");
      }
      return rows;
    } catch (error) {
      if (mountedRef.current) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load cloud tournaments.",
        );
      }
      return [] as CloudTournamentRow[];
    }
  }, []);

  const backupTournament = useCallback(
    async (tournament: Tournament, automatic = false) => {
      if (
        typeof navigator !== "undefined" &&
        (!navigator.onLine || inFlightIds.current.has(tournament.id))
      ) {
        return;
      }

      inFlightIds.current.add(tournament.id);
      setStatusById((current) => ({
        ...current,
        [tournament.id]: {
          state: "syncing",
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          message: automatic
            ? `Creating ${tournament.name} cloud backup...`
            : `Saving ${tournament.name} to the cloud...`,
          changedAt: new Date().toISOString(),
        },
      }));

      try {
        const row = await syncTournamentToCloud(tournament);
        if (!mountedRef.current) return;

        upsertCloudRow(row);
        setOwnershipConflictIds((current) => {
          const next = { ...current };
          delete next[tournament.id];
          return next;
        });
        setStatusById((current) => ({
          ...current,
          [tournament.id]: {
            state: "synced",
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            message: `${tournament.name} is safely backed up.`,
            changedAt: new Date().toISOString(),
          },
        }));
      } catch (error) {
        if (!mountedRef.current) return;

        if (error instanceof CloudTournamentOwnershipError) {
          setOwnershipConflictIds((current) => ({
            ...current,
            [tournament.id]: true,
          }));
        }

        setStatusById((current) => ({
          ...current,
          [tournament.id]: {
            state: "error",
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            message:
              error instanceof Error
                ? error.message
                : "Cloud backup failed. Tap Retry backup.",
            changedAt: new Date().toISOString(),
          },
        }));
      } finally {
        inFlightIds.current.delete(tournament.id);
      }
    },
    [upsertCloudRow],
  );

  useEffect(() => {
    mountedRef.current = true;

    const initialize = window.setTimeout(() => {
      const localTournaments = getTournaments();
      setLocal(localTournaments);
      setOnline(navigator.onLine);

      void loadCloud().then((rows) => {
        if (!mountedRef.current || !navigator.onLine) return;

        const cloudIds = new Set(rows.map((row) => row.id));
        for (const tournament of localTournaments) {
          if (
            !cloudIds.has(tournament.id) &&
            !automaticallyAttemptedIds.current.has(tournament.id)
          ) {
            automaticallyAttemptedIds.current.add(tournament.id);
            void backupTournament(tournament, true);
          }
        }
      });
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

    const handleOnline = () => {
      setOnline(true);
      void loadCloud();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialize);
      unsubscribeLocal();
      unsubscribeStatus();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [backupTournament, loadCloud]);

  const cloudById = useMemo(
    () => new Map(cloud.map((row) => [row.id, row])),
    [cloud],
  );

  function createCurrentAccountCopy(tournament: Tournament) {
    const now = new Date().toISOString();
    const copy: Tournament = {
      ...tournament,
      id: makeId(),
      name: `${tournament.name} Cloud Copy`,
      players: [...tournament.players],
      createdAt: now,
      updatedAt: now,
    };

    const next = [copy, ...getTournaments()];
    saveTournaments(next);
    setLocal(next);
    automaticallyAttemptedIds.current.add(copy.id);
    setMessage(
      `Created ${copy.name} with a new ID and started its cloud backup.`,
    );
    void backupTournament(copy);
  }

  async function toggleVisibility(row: CloudTournamentRow) {
    setVisibilityBusyId(row.id);
    setMessage("");

    try {
      const updated = await setCloudTournamentVisibility(
        row.id,
        !row.is_public,
      );
      upsertCloudRow(updated);
      setMessage(
        updated.is_public
          ? `${updated.name} is now visible to spectators.`
          : `${updated.name} is now private. Its backup remains safe.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Visibility update failed.",
      );
    } finally {
      setVisibilityBusyId("");
    }
  }

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/20 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            Automatic cloud backup
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">
            Every tournament change saves itself.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Missing backups are retried directly from this page. After a
            tournament says Synced, make it public to activate its spectator
            link and QR code.
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
            const ownershipConflict =
              ownershipConflictIds[tournament.id] === true;

            return (
              <article
                key={tournament.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-black text-white">
                      {tournament.name}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                        hasError
                          ? "bg-rose-400/10 text-rose-300"
                          : isWorking
                            ? "bg-amber-400/10 text-amber-300"
                            : cloudRow
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-slate-400/10 text-slate-300"
                      }`}
                    >
                      {hasError
                        ? "Needs attention"
                        : isWorking
                          ? "Saving..."
                          : cloudRow
                            ? "Synced"
                            : "Not backed up"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {tournament.players.length} players · {tournament.status}
                    {cloudRow
                      ? ` · Cloud ${timeLabel(cloudRow.updated_at)}`
                      : ""}
                  </p>

                  {syncStatus?.message ? (
                    <p
                      className={`mt-2 text-xs font-semibold ${
                        hasError ? "text-rose-300" : "text-slate-400"
                      }`}
                    >
                      {syncStatus.message}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!cloudRow ? (
                    <button
                      type="button"
                      onClick={() => void backupTournament(tournament)}
                      disabled={!online || isWorking}
                      className="min-h-11 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                    >
                      {isWorking
                        ? "Saving..."
                        : hasError
                          ? "Retry backup"
                          : "Back up now"}
                    </button>
                  ) : null}

                  {ownershipConflict ? (
                    <button
                      type="button"
                      onClick={() => createCurrentAccountCopy(tournament)}
                      className="min-h-11 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-black text-amber-200"
                    >
                      Save as my cloud copy
                    </button>
                  ) : null}

                  {cloudRow ? (
                    <button
                      type="button"
                      onClick={() => void toggleVisibility(cloudRow)}
                      disabled={visibilityBusyId === cloudRow.id}
                      className="min-h-11 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-slate-300 hover:border-cyan-300/30 hover:text-white disabled:opacity-50"
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
                      className="flex min-h-11 items-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-slate-950 hover:bg-cyan-300"
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
