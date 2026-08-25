export const REGISTRATION_STATUSES = [
  "pending",
  "approved",
  "waitlisted",
  "checked_in",
  "withdrawn",
  "rejected",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export function cleanRegistrationName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateRegistrationName(value: string) {
  const clean = cleanRegistrationName(value);
  if (clean.length < 2 || clean.length > 40) {
    return { ok: false as const, message: "Tournament name must be between 2 and 40 characters." };
  }
  return { ok: true as const, value: clean };
}

export function mergeCheckedInPlayers(
  existingPlayers: string[],
  checkedInNames: string[],
  capacity: number,
) {
  const players = [...existingPlayers];
  const seen = new Set(existingPlayers.map((player) => player.trim().toLowerCase()));
  let duplicates = 0;
  let overflow = 0;

  for (const rawName of checkedInNames) {
    const name = cleanRegistrationName(rawName);
    const normalized = name.toLowerCase();
    if (!name || seen.has(normalized)) {
      duplicates += 1;
      continue;
    }
    if (players.length >= capacity) {
      overflow += 1;
      continue;
    }
    players.push(name);
    seen.add(normalized);
  }

  return {
    players,
    added: players.length - existingPlayers.length,
    duplicates,
    overflow,
  };
}
