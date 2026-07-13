export type CloudSyncState =
  | "idle"
  | "queued"
  | "syncing"
  | "synced"
  | "offline"
  | "error"
  | "deleted";

export interface CloudSyncStatusDetail {
  state: CloudSyncState;
  tournamentId?: string;
  tournamentName?: string;
  message?: string;
  changedAt: string;
}

export const CLOUD_SYNC_STATUS_EVENT = "cuebracket:cloud-sync-status";

export function publishCloudSyncStatus(
  detail: Omit<CloudSyncStatusDetail, "changedAt">,
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CloudSyncStatusDetail>(CLOUD_SYNC_STATUS_EVENT, {
      detail: {
        ...detail,
        changedAt: new Date().toISOString(),
      },
    }),
  );
}

export function subscribeToCloudSyncStatus(
  callback: (detail: CloudSyncStatusDetail) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    callback((event as CustomEvent<CloudSyncStatusDetail>).detail);
  };

  window.addEventListener(CLOUD_SYNC_STATUS_EVENT, listener);
  return () => window.removeEventListener(CLOUD_SYNC_STATUS_EVENT, listener);
}
