export type PendingCloudMode = "upsert" | "delete";

export interface PendingCloudChange {
  tournamentId: string;
  userId: string;
  mode: PendingCloudMode;
  queuedAt: string;
}

const STORAGE_KEY = "cuebracket:cloud-pending:v1";

function readAll(): Partial<Record<string, PendingCloudChange>> {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, PendingCloudChange>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(changes: Partial<Record<string, PendingCloudChange>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(changes));
}

function storageId(userId: string, tournamentId: string) {
  return `${userId}:${tournamentId}`;
}

export function queuePendingCloudChange(
  tournamentId: string,
  userId: string,
  mode: PendingCloudMode,
) {
  const changes = readAll();
  changes[storageId(userId, tournamentId)] = {
    tournamentId,
    userId,
    mode,
    queuedAt: new Date().toISOString(),
  };
  writeAll(changes);
}

export function clearPendingCloudChange(
  tournamentId: string,
  userId: string,
) {
  const changes = readAll();
  const key = storageId(userId, tournamentId);
  if (!(key in changes)) return;
  delete changes[key];
  writeAll(changes);
}

export function getPendingCloudChanges(userId: string) {
  return Object.values(readAll()).filter(
    (change): change is PendingCloudChange =>
      Boolean(change && change.userId === userId),
  );
}

export function getPendingCloudChange(
  tournamentId: string,
  userId: string,
) {
  return readAll()[storageId(userId, tournamentId)] ?? null;
}
