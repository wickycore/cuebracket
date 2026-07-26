import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const managerPath = path.join(
  projectRoot,
  "components",
  "BracketManager.tsx",
);

if (!fs.existsSync(managerPath)) {
  throw new Error(`BracketManager.tsx was not found: ${managerPath}`);
}

let source = fs.readFileSync(managerPath, "utf8");

const importPattern =
  /import\s*\{\s*updateTournament\s*\}\s*from\s*"@\/lib\/tournaments";/;

if (importPattern.test(source)) {
  source = source.replace(
    importPattern,
    'import { getTournament, updateTournament } from "@/lib/tournaments";',
  );
}

const repairMarker = "// 0.9F.6 stale-safe single bracket repair";

if (!source.includes(repairMarker)) {
  const repairPattern =
    /  \/\/ Repair data saved by older engine versions\.\r?\n  useEffect\(\(\) => \{[\s\S]*?\r?\n  \}, \[bracket, onTournamentChange, tournament\.id, tournament\.status\]\);/;

  const replacement = `  ${repairMarker}
  useEffect(() => {
    if (!bracket) return;

    const renderedFingerprint = bracketFingerprint(bracket);
    const latestTournament = getTournament(tournament.id);
    const latestBracket =
      latestTournament?.bracket?.type === "single"
        ? latestTournament.bracket
        : undefined;

    // Never let an old render overwrite a newer score or late-entry update.
    if (
      !latestTournament ||
      !latestBracket ||
      bracketFingerprint(latestBracket) !== renderedFingerprint
    ) {
      return;
    }

    let repaired = recomputeSingleEliminationBracket(latestBracket);

    // Safe recovery for the reported case: a late player is already in the
    // roster but the older BYE bracket was restored before any match started.
    if (countSingleEliminationPlayedMatches(repaired) === 0) {
      const bracketPlayers = new Set<string>();

      for (const match of repaired.rounds[0]?.matches ?? []) {
        if (match.player1) bracketPlayers.add(match.player1.toLowerCase());
        if (match.player2) bracketPlayers.add(match.player2.toLowerCase());
      }

      const missingPlayers = latestTournament.players.filter(
        (player) => !bracketPlayers.has(player.toLowerCase()),
      );

      const openSlots = getSingleEliminationLateEntrySlots(repaired).filter(
        (slot) => slot.available,
      );

      if (missingPlayers.length === 1 && openSlots.length === 1) {
        const recovery = fillSingleEliminationByeSlot(
          repaired,
          openSlots[0].matchId,
          missingPlayers[0],
        );

        if (recovery.ok) repaired = recovery.bracket;
      }
    }

    const repairedStatus = repaired.champion
      ? "completed"
      : latestTournament.status === "completed"
        ? "live"
        : latestTournament.status;

    if (
      bracketFingerprint(repaired) === bracketFingerprint(latestBracket) &&
      repairedStatus === latestTournament.status
    ) {
      return;
    }

    const updated = updateTournament(latestTournament.id, {
      bracket: repaired,
      status: repairedStatus,
    });

    if (updated) onTournamentChange(updated);
  }, [bracket, onTournamentChange, tournament.id]);`;

  if (!repairPattern.test(source)) {
    throw new Error(
      "The old single-elimination repair effect was not found. No file was changed.",
    );
  }

  source = source.replace(repairPattern, replacement);
}

const lateEntryMarker = "// 0.9F.6 latest-state single late entry";

if (!source.includes(lateEntryMarker)) {
  const lateEntryPattern =
    /  function addLatePlayer\(playerName: string, matchId: string\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  if \(!bracket\)/;

  const replacement = `  ${lateEntryMarker}
  function addLatePlayer(playerName: string, matchId: string) {
    const latestTournament = getTournament(tournament.id) ?? tournament;
    const latestBracket =
      latestTournament.bracket?.type === "single"
        ? latestTournament.bracket
        : bracket;

    if (!latestBracket) return "The bracket has not been generated.";

    const normalizedName = playerName.trim();

    if (!normalizedName) {
      return "Enter the late player's name.";
    }

    if (latestTournament.players.length >= latestTournament.bracketSize) {
      return \`This event is full at \${latestTournament.bracketSize} players.\`;
    }

    if (
      latestTournament.players.some(
        (player) => player.toLowerCase() === normalizedName.toLowerCase(),
      )
    ) {
      return "That player is already in the tournament.";
    }

    const openSlot = getSingleEliminationLateEntrySlots(latestBracket).find(
      (slot) => slot.matchId === matchId && slot.available,
    );

    if (!openSlot) {
      return "That BYE slot is no longer available. Refresh the tournament and choose another open slot.";
    }

    const result = fillSingleEliminationByeSlot(
      latestBracket,
      matchId,
      normalizedName,
    );

    if (!result.ok) return result.reason;

    const updated = updateTournament(latestTournament.id, {
      players: [...latestTournament.players, normalizedName],
      bracket: result.bracket,
      status:
        latestTournament.status === "completed"
          ? "live"
          : latestTournament.status,
    });

    if (!updated) return "The late player could not be saved.";

    setDraftScores({});
    setMessage("");
    onTournamentChange(updated);
    return null;
  }

  if (!bracket)`;

  if (!lateEntryPattern.test(source)) {
    throw new Error(
      "The old single-elimination late-entry handler was not found. No file was changed.",
    );
  }

  source = source.replace(lateEntryPattern, replacement);
}

const required = [
  'import { getTournament, updateTournament } from "@/lib/tournaments";',
  repairMarker,
  lateEntryMarker,
];

for (const value of required) {
  if (!source.includes(value)) {
    throw new Error(`Verification failed: ${value}`);
  }
}

const backup = `${managerPath}.before-0.9f6`;
if (!fs.existsSync(backup)) {
  fs.copyFileSync(managerPath, backup);
}

fs.writeFileSync(managerPath, source, "utf8");

console.log("");
console.log("CueBracket 0.9F.6 navigation stability hotfix applied.");
console.log("");
console.log("The tournament page will no longer run the old connector mutation loop.");
console.log("Single-elimination late entry now uses the latest saved tournament.");
console.log(`Backup: ${backup}`);
