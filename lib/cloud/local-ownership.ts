const STORAGE_KEY = "cuebracket:cloud-owners:v1";

function readOwners(): Partial<Record<string, string>> {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOwners(owners: Partial<Record<string, string>>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(owners));
}

export function getLocalCloudOwner(tournamentId: string) {
  return readOwners()[tournamentId] ?? null;
}

export function setLocalCloudOwner(tournamentId: string, ownerId: string) {
  const owners = readOwners();
  owners[tournamentId] = ownerId;
  writeOwners(owners);
}

export function removeLocalCloudOwner(tournamentId: string) {
  const owners = readOwners();
  if (!(tournamentId in owners)) return;
  delete owners[tournamentId];
  writeOwners(owners);
}
