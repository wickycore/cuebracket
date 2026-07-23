import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const managerPath = path.join(root, "components", "BracketManager.tsx");

if (!fs.existsSync(managerPath)) {
  throw new Error(`BracketManager.tsx was not found at ${managerPath}`);
}

let source = fs.readFileSync(managerPath, "utf8");

if (!source.includes("getTournament, updateTournament")) {
  const oldImport = 'import { updateTournament } from "@/lib/tournaments";';
  const newImport =
    'import { getTournament, updateTournament } from "@/lib/tournaments";';

  if (!source.includes(oldImport)) {
    throw new Error(
      "The expected tournaments import was not found. No changes were written.",
    );
  }

  source = source.replace(oldImport, newImport);
}

const repairMarker = "// 0.9F.4 stale-safe bracket repair";
if (!source.includes(repairMarker)) {
  const repairPattern =
    /  \/\/ Repair data saved by older engine versions\.\r?\n  useEffect\(\(\) => \{[\s\S]*?\r?\n  \}, \[bracket, onTournamentChange, tournament\.id, tournament\.status\]\);/;

  const repairReplacement = `  ${repairMarker}
  useEffect(() => {
    if (!bracket) return;

    const sourceFingerprint = bracketFingerprint(bracket);
    const latestTournament = getTournament(tournament.id);
    const latestBracket =
      latestTournament?.bracket?.type === "single"
        ? latestTournament.bracket
        : undefined;

    // A newer user action has already replaced this render's bracket.
    // Never let a stale repair effect overwrite a late entry or score update.
    if (
      !latestTournament ||
      !latestBracket ||
      bracketFingerprint(latestBracket) !== sourceFingerprint
    ) {
      return;
    }

    let repaired = recomputeSingleEliminationBracket(latestBracket);

    // Recover the exact corruption seen when a late player was added to the
    // roster but an older repair effect restored the previous BYE bracket.
    // This is safe only before any real match has been played and when there
    // is exactly one missing roster player and one open BYE.
    if (countSingleEliminationPlayedMatches(repaired) === 0) {
      const firstRoundPlayers = new Set<string>();

      for (const match of repaired.rounds[0]?.matches ?? []) {
        if (match.player1) firstRoundPlayers.add(match.player1.toLowerCase());
        if (match.player2) firstRoundPlayers.add(match.player2.toLowerCase());
      }

      const missingPlayers = latestTournament.players.filter(
        (player) => !firstRoundPlayers.has(player.toLowerCase()),
      );
      const openSlots = getSingleEliminationLateEntrySlots(repaired).filter(
        (slot) => slot.available,
      );

      if (missingPlayers.length === 1 && openSlots.length === 1) {
        const recovered = fillSingleEliminationByeSlot(
          repaired,
          openSlots[0].matchId,
          missingPlayers[0],
        );

        if (recovered.ok) repaired = recovered.bracket;
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
      "The older repair effect was not found. No changes were written.",
    );
  }

  source = source.replace(repairPattern, repairReplacement);
}

const lateEntryMarker = "// 0.9F.4 fresh-state late entry";
if (!source.includes(lateEntryMarker)) {
  const lateEntryPattern =
    /  function addLatePlayer\(playerName: string, matchId: string\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  if \(!bracket\)/;

  const lateEntryReplacement = `  ${lateEntryMarker}
  function addLatePlayer(playerName: string, matchId: string) {
    const latestTournament = getTournament(tournament.id) ?? tournament;
    const latestBracket =
      latestTournament.bracket?.type === "single"
        ? latestTournament.bracket
        : bracket;

    if (!latestBracket) return "The bracket has not been generated.";

    if (latestTournament.players.length >= latestTournament.bracketSize) {
      return \`This event is full at \${latestTournament.bracketSize} players.\`;
    }

    if (
      latestTournament.players.some(
        (player) => player.toLowerCase() === playerName.toLowerCase(),
      )
    ) {
      return "That player is already in the tournament.";
    }

    const result = fillSingleEliminationByeSlot(
      latestBracket,
      matchId,
      playerName,
    );

    if (!result.ok) return result.reason;

    const updated = updateTournament(latestTournament.id, {
      players: [...latestTournament.players, playerName],
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
      "The older addLatePlayer function was not found. No changes were written.",
    );
  }

  source = source.replace(lateEntryPattern, lateEntryReplacement);
}

const backupPath = `${managerPath}.before-0.9f4`;
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(managerPath, backupPath);
}

fs.writeFileSync(managerPath, source, "utf8");

const checks = [
  'import { getTournament, updateTournament } from "@/lib/tournaments";',
  repairMarker,
  lateEntryMarker,
];

for (const check of checks) {
  if (!source.includes(check)) {
    throw new Error(`Verification failed: ${check}`);
  }
}

console.log("Tournament stability patch applied successfully.");
console.log(`Backup saved at: ${backupPath}`);
