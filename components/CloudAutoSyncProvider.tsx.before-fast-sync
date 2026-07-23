"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import type {
  AuthChangeEvent,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  REALTIME_SUBSCRIBE_STATES,
  Session,
} from "@supabase/supabase-js";
import {
  CloudTournamentOwnershipError,
  deleteCloudTournament,
  getMyCloudTournaments,
  rowToTournament,
  syncTournamentToCloud,
  type CloudTournamentRow,
} from "@/lib/cloud/tournaments";
import { publishCloudSyncStatus } from "@/lib/cloud/sync-events";
import {
  getLocalCloudOwner,
  removeLocalCloudOwner,
  setLocalCloudOwner,
} from "@/lib/cloud/local-ownership";
import {
  clearPendingCloudChange,
  getPendingCloudChange,
  getPendingCloudChanges,
  queuePendingCloudChange,
} from "@/lib/cloud/pending-sync";
import { createClient } from "@/lib/supabase/client";
import {
  getTournament,
  getTournaments,
  saveTournaments,
  subscribeToTournamentChanges,
  type Tournament,
} from "@/lib/tournaments";

const SYNC_DEBOUNCE_MS = 650;
const RETRY_DELAY_MS = 5000;

function timestamp(value: string | undefined) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function tournamentFingerprint(tournament: Tournament) {
  return JSON.stringify(tournament, (key, value) =>
    key === "updatedAt" ? undefined : value,
  );
}

function mergeTournament(local: Tournament[], incoming: Tournament) {
  const index = local.findIndex((item) => item.id === incoming.id);
  if (index === -1) return [incoming, ...local];

  const next = [...local];
  next[index] = incoming;
  return next;
}

export function CloudAutoSyncProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let userId: string | null = null;
    let applyingRemoteChange = false;
    let realtimeChannel: RealtimeChannel | null = null;
    let reconcileRun = 0;
    let authReconcileTimer: ReturnType<typeof setTimeout> | null = null;

    const observedLocalFingerprints = new Map<string, string>();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const dirtyIds = new Set<string>();
    const syncingIds = new Set<string>();
    const offlineIds = new Set<string>();
    const retryAttempts = new Map<string, number>();

    function clearTimer(id: string) {
      const timer = timers.get(id);
      if (timer) clearTimeout(timer);
      timers.delete(id);
    }

    function rememberLocalState(tournaments = getTournaments()) {
      observedLocalFingerprints.clear();
      for (const tournament of tournaments) {
        observedLocalFingerprints.set(
          tournament.id,
          tournamentFingerprint(tournament),
        );
      }
    }

    function writeRemoteState(tournaments: Tournament[]) {
      applyingRemoteChange = true;
      try {
        saveTournaments(tournaments);
      } finally {
        applyingRemoteChange = false;
      }
      rememberLocalState(tournaments);
    }

    function applyRemoteRow(row: CloudTournamentRow) {
      if (!active || row.owner_id !== userId) return;
      setLocalCloudOwner(row.id, row.owner_id);
      if (dirtyIds.has(row.id) || syncingIds.has(row.id)) return;

      const incoming = rowToTournament(row);
      const current = getTournament(row.id);

      if (
        current &&
        timestamp(current.updatedAt) > timestamp(incoming.updatedAt)
      ) {
        scheduleSync(row.id);
        return;
      }

      writeRemoteState(mergeTournament(getTournaments(), incoming));
      publishCloudSyncStatus({
        state: "synced",
        tournamentId: incoming.id,
        tournamentName: incoming.name,
        message: `${incoming.name} updated from the cloud.`,
      });
    }

    function applyRemoteDelete(id: string) {
      if (!active || dirtyIds.has(id) || syncingIds.has(id)) return;

      const current = getTournament(id);
      if (!current) return;

      writeRemoteState(getTournaments().filter((item) => item.id !== id));
      removeLocalCloudOwner(id);
      publishCloudSyncStatus({
        state: "deleted",
        tournamentId: id,
        tournamentName: current.name,
        message: `${current.name} was removed from the cloud.`,
      });
    }

    async function flush(id: string) {
      clearTimer(id);
      if (!active || !userId || syncingIds.has(id)) return;

      const syncUserId = userId;
      const knownOwner = getLocalCloudOwner(id);
      if (knownOwner && knownOwner !== syncUserId) {
        dirtyIds.delete(id);
        clearPendingCloudChange(id, syncUserId);
        publishCloudSyncStatus({
          state: "error",
          tournamentId: id,
          tournamentName: getTournament(id)?.name,
          message: "This local tournament belongs to another organizer account.",
        });
        return;
      }

      syncingIds.add(id);

      try {
        while (active && userId === syncUserId && dirtyIds.has(id)) {
          dirtyIds.delete(id);
          const tournament = getTournament(id);

          if (typeof navigator !== "undefined" && !navigator.onLine) {
            dirtyIds.add(id);
            offlineIds.add(id);
            publishCloudSyncStatus({
              state: "offline",
              tournamentId: id,
              tournamentName: tournament?.name,
              message: "Offline. This change is queued and will sync automatically.",
            });
            break;
          }

          publishCloudSyncStatus({
            state: "syncing",
            tournamentId: id,
            tournamentName: tournament?.name,
            message: tournament
              ? `Saving ${tournament.name} to the cloud...`
              : "Removing tournament from the cloud...",
          });

          if (tournament) {
            const savedRow = await syncTournamentToCloud(tournament);
            if (!active || userId !== syncUserId) return;

            const latest = getTournament(id);
            if (
              latest &&
              latest.updatedAt === tournament.updatedAt &&
              !dirtyIds.has(id)
            ) {
              writeRemoteState(
                mergeTournament(getTournaments(), rowToTournament(savedRow)),
              );
            }

            setLocalCloudOwner(id, syncUserId);
            clearPendingCloudChange(id, syncUserId);
            retryAttempts.delete(id);
            offlineIds.delete(id);
            publishCloudSyncStatus({
              state: "synced",
              tournamentId: id,
              tournamentName: tournament.name,
              message: `${tournament.name} is safely backed up.`,
            });
          } else {
            await deleteCloudTournament(id);
            if (!active || userId !== syncUserId) return;
            removeLocalCloudOwner(id);
            clearPendingCloudChange(id, syncUserId);
            retryAttempts.delete(id);
            offlineIds.delete(id);
            publishCloudSyncStatus({
              state: "deleted",
              tournamentId: id,
              message: "Tournament removed from the cloud.",
            });
          }
        }
      } catch (error) {
        if (!active || userId !== syncUserId) return;

        if (error instanceof CloudTournamentOwnershipError) {
          dirtyIds.delete(id);
          clearPendingCloudChange(id, syncUserId);
          retryAttempts.delete(id);
          publishCloudSyncStatus({
            state: "error",
            tournamentId: id,
            tournamentName: getTournament(id)?.name,
            message: error.message,
          });
          return;
        }

        dirtyIds.add(id);
        const tournament = getTournament(id);
        publishCloudSyncStatus({
          state: "error",
          tournamentId: id,
          tournamentName: tournament?.name,
          message:
            error instanceof Error
              ? error.message
              : "Cloud synchronization failed. CueBracket will retry.",
        });

        if (active) {
          const attempt = (retryAttempts.get(id) ?? 0) + 1;
          retryAttempts.set(id, attempt);
          clearTimer(id);

          const delay = Math.min(
            RETRY_DELAY_MS * 2 ** Math.min(attempt - 1, 4),
            60_000,
          );
          timers.set(id, setTimeout(() => void flush(id), delay));
        }
      } finally {
        syncingIds.delete(id);

        if (
          active &&
          dirtyIds.has(id) &&
          !offlineIds.has(id) &&
          !timers.has(id)
        ) {
          timers.set(id, setTimeout(() => void flush(id), SYNC_DEBOUNCE_MS));
        }
      }
    }

    function scheduleSync(id: string, delay = SYNC_DEBOUNCE_MS) {
      if (!active || !userId) return;

      const knownOwner = getLocalCloudOwner(id);
      if (knownOwner && knownOwner !== userId) {
        publishCloudSyncStatus({
          state: "error",
          tournamentId: id,
          tournamentName: getTournament(id)?.name,
          message: "This local tournament belongs to another organizer account.",
        });
        return;
      }

      const tournament = getTournament(id);
      queuePendingCloudChange(
        id,
        userId,
        tournament ? "upsert" : "delete",
      );
      dirtyIds.add(id);
      offlineIds.delete(id);
      retryAttempts.delete(id);
      clearTimer(id);

      publishCloudSyncStatus({
        state: "queued",
        tournamentId: id,
        tournamentName: tournament?.name,
        message: tournament
          ? `${tournament.name} change queued for cloud backup.`
          : "Tournament deletion queued for cloud backup.",
      });

      timers.set(id, setTimeout(() => void flush(id), delay));
    }

    function handleLocalChanges() {
      if (applyingRemoteChange || !userId) return;

      const current = getTournaments();
      const currentFingerprints = new Map(
        current.map((tournament) => [
          tournament.id,
          tournamentFingerprint(tournament),
        ]),
      );

      for (const tournament of current) {
        const previousFingerprint = observedLocalFingerprints.get(tournament.id);
        const currentFingerprint = currentFingerprints.get(tournament.id);
        if (
          !previousFingerprint ||
          previousFingerprint !== currentFingerprint
        ) {
          scheduleSync(tournament.id);
        }
      }

      for (const id of observedLocalFingerprints.keys()) {
        if (!currentFingerprints.has(id)) scheduleSync(id);
      }

      observedLocalFingerprints.clear();
      for (const [id, fingerprint] of currentFingerprints) {
        observedLocalFingerprints.set(id, fingerprint);
      }
    }

    function stopRealtime() {
      if (!realtimeChannel) return;
      void supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    function startRealtime(ownerId: string) {
      stopRealtime();

      realtimeChannel = supabase
        .channel(`cuebracket-owner-${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cloud_tournaments",
            filter: `owner_id=eq.${ownerId}`,
          },
          (payload: RealtimePostgresChangesPayload<CloudTournamentRow>) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as unknown as Partial<CloudTournamentRow>;
              if (oldRow.id) applyRemoteDelete(oldRow.id);
              return;
            }

            applyRemoteRow(payload.new as unknown as CloudTournamentRow);
          },
        )
        .subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            publishCloudSyncStatus({
              state: "error",
              message: "Realtime connection interrupted. CueBracket will reconnect.",
            });
          }
        });
    }

    async function reconcile() {
      const run = ++reconcileRun;
      const isCurrent = () => active && run === reconcileRun;

      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) throw error;
        if (!isCurrent()) return;

        if (!user) {
          userId = null;
          stopRealtime();
          rememberLocalState();
          publishCloudSyncStatus({ state: "idle" });
          return;
        }

        userId = user.id;

        for (const pending of getPendingCloudChanges(user.id)) {
          dirtyIds.add(pending.tournamentId);
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            offlineIds.add(pending.tournamentId);
          }
        }

        const cloudRows = await getMyCloudTournaments();
        if (!isCurrent() || userId !== user.id) return;

        const cloudById = new Map(cloudRows.map((row) => [row.id, row]));
        let local = getTournaments();
        let changedLocally = false;

        for (const row of cloudRows) {
          setLocalCloudOwner(row.id, user.id);
          let pending = getPendingCloudChange(row.id, user.id);
          const existing = local.find((item) => item.id === row.id);

          // An upsert cannot be replayed after its local tournament disappeared.
          // In that unusual case, restore the safe cloud copy instead of deleting it.
          if (pending?.mode === "upsert" && !existing) {
            clearPendingCloudChange(row.id, user.id);
            dirtyIds.delete(row.id);
            pending = null;
          }

          // A queued local update or deletion always wins until it is uploaded.
          // This also prevents an offline deletion from being restored by reconcile.
          if (pending || dirtyIds.has(row.id)) continue;

          const incoming = rowToTournament(row);

          if (
            !existing ||
            timestamp(incoming.updatedAt) > timestamp(existing.updatedAt)
          ) {
            local = mergeTournament(local, incoming);
            changedLocally = true;
          }
        }

        if (!isCurrent()) return;
        if (changedLocally) writeRemoteState(local);
        else rememberLocalState(local);

        for (const pending of getPendingCloudChanges(user.id)) {
          if (
            pending.mode === "upsert" &&
            !local.some((item) => item.id === pending.tournamentId)
          ) {
            clearPendingCloudChange(pending.tournamentId, user.id);
            dirtyIds.delete(pending.tournamentId);
            publishCloudSyncStatus({
              state: "error",
              tournamentId: pending.tournamentId,
              message: "A queued backup was skipped because its local tournament is missing.",
            });
            continue;
          }

          scheduleSync(pending.tournamentId, 100);
        }

        for (const tournament of local) {
          const cloud = cloudById.get(tournament.id);
          if (
            !cloud ||
            timestamp(tournament.updatedAt) > timestamp(cloud.updated_at)
          ) {
            scheduleSync(tournament.id, 100);
          }
        }

        if (!isCurrent()) return;
        startRealtime(user.id);
        publishCloudSyncStatus({
          state: "synced",
          message: "Cloud backup is active on this device.",
        });
      } catch (error) {
        if (!isCurrent()) return;
        publishCloudSyncStatus({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to start cloud synchronization.",
        });
      }
    }

    const unsubscribeLocal = subscribeToTournamentChanges(handleLocalChanges);
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      session: Session | null,
    ) => {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId !== userId) {
        userId = nextUserId;
        dirtyIds.clear();
        offlineIds.clear();
        retryAttempts.clear();
        for (const id of timers.keys()) clearTimer(id);
        stopRealtime();

        // Supabase recommends returning from the auth callback before making
        // another auth/database call, which avoids callback lockups.
        if (authReconcileTimer) clearTimeout(authReconcileTimer);
        authReconcileTimer = setTimeout(() => {
          authReconcileTimer = null;
          if (active) void reconcile();
        }, 0);
      }
    });

    const handleOnline = () => {
      const queuedOfflineIds = [...offlineIds];
      offlineIds.clear();
      publishCloudSyncStatus({
        state: "queued",
        message: "Connection restored. Checking queued changes...",
      });
      void reconcile().then(() => {
        if (!active) return;
        for (const id of queuedOfflineIds) scheduleSync(id, 100);
        for (const id of dirtyIds) scheduleSync(id, 100);
      });
    };

    const handleOffline = () => {
      publishCloudSyncStatus({
        state: "offline",
        message: "Offline. Changes remain safe on this device and are queued.",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    rememberLocalState();
    void reconcile();

    return () => {
      active = false;
      reconcileRun += 1;
      unsubscribeLocal();
      authSubscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopRealtime();
      if (authReconcileTimer) clearTimeout(authReconcileTimer);
      for (const id of timers.keys()) clearTimer(id);
    };
  }, []);

  return children;
}
