export interface PlayerProfileInput {
  displayName: string;
  username: string;
  tournamentName: string;
  bio: string;
}

export interface CleanPlayerProfile {
  displayName: string;
  username: string;
  tournamentName: string;
  bio: string;
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validatePlayerProfile(input: PlayerProfileInput):
  | { ok: true; value: CleanPlayerProfile }
  | { ok: false; message: string } {
  const value = {
    displayName: input.displayName.trim(),
    username: normalizeUsername(input.username),
    tournamentName: input.tournamentName.trim(),
    bio: input.bio.trim(),
  };

  if (value.displayName.length < 2 || value.displayName.length > 50) {
    return { ok: false, message: "Your profile name must be between 2 and 50 characters." };
  }

  if (!/^[a-z0-9_]{3,24}$/.test(value.username)) {
    return {
      ok: false,
      message: "Your username must be 3–24 characters using lowercase letters, numbers or underscores.",
    };
  }

  if (value.tournamentName.length < 2 || value.tournamentName.length > 40) {
    return { ok: false, message: "Your tournament name must be between 2 and 40 characters." };
  }

  if (value.bio.length > 160) {
    return { ok: false, message: "Your player bio must be 160 characters or fewer." };
  }

  return { ok: true, value };
}
