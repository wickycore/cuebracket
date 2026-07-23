import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const doubleManagerPath = path.join(
  projectRoot,
  "components",
  "DoubleEliminationManager.tsx",
);
const competitionManagerPath = path.join(
  projectRoot,
  "components",
  "CompetitionManager.tsx",
);

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
}

function backup(filePath, suffix) {
  const backupPath = `${filePath}.${suffix}`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  return backupPath;
}

requireFile(doubleManagerPath);
requireFile(competitionManagerPath);

/* -------------------------------------------------------------------------- */
/* Double-elimination late-entry fresh-state protection                       */
/* -------------------------------------------------------------------------- */

let doubleSource = fs.readFileSync(doubleManagerPath, "utf8");

if (!doubleSource.includes("getTournament,")) {
  const importPattern =
    /(\bformatDuration,\s*)(\bgetTournamentChampionDescription,)/;

  if (!importPattern.test(doubleSource)) {
    throw new Error(
      "Could not find the tournament helper import in DoubleEliminationManager.tsx. No files were changed.",
    );
  }

  doubleSource = doubleSource.replace(
    importPattern,
    `$1getTournament,\n  $2`,
  );
}

const doubleMarker = "// 0.9F.5 fresh-state double late entry";

if (!doubleSource.includes(doubleMarker)) {
  const functionPattern =
    /  function addLatePlayer\(playerName: string, matchId: string\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  if \(!bracket\)/;

  const replacement = `  ${doubleMarker}
  function addLatePlayer(playerName: string, matchId: string) {
    const latestTournament = getTournament(tournament.id) ?? tournament;
    const latestBracket =
      latestTournament.bracket?.type === "double"
        ? latestTournament.bracket
        : bracket;

    if (!latestBracket) {
      return "The bracket has not been generated.";
    }

    if (latestTournament.players.length >= latestTournament.bracketSize) {
      return \`This event is full at \${latestTournament.bracketSize} players.\`;
    }

    const normalizedName = playerName.trim();

    if (!normalizedName) {
      return "Enter the late player's name.";
    }

    if (
      latestTournament.players.some(
        (player) => player.toLowerCase() === normalizedName.toLowerCase(),
      )
    ) {
      return "That player is already in the tournament.";
    }

    const availableSlot = getDoubleEliminationLateEntrySlots(
      latestBracket,
    ).find((slot) => slot.matchId === matchId && slot.available);

    if (!availableSlot) {
      return "That BYE slot is no longer available. Refresh the tournament and choose another open slot.";
    }

    const result = fillDoubleEliminationByeSlot(
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

    setDrafts({});
    setMessage("");
    onTournamentChange(updated);
    return null;
  }

  if (!bracket)`;

  if (!functionPattern.test(doubleSource)) {
    throw new Error(
      "Could not locate addLatePlayer in DoubleEliminationManager.tsx. No files were changed.",
    );
  }

  doubleSource = doubleSource.replace(functionPattern, replacement);
}

/* -------------------------------------------------------------------------- */
/* Strict race-to validation for shared competition formats                   */
/* -------------------------------------------------------------------------- */

let competitionSource = fs.readFileSync(competitionManagerPath, "utf8");

const validatorImport =
  'import { isValidRaceResult } from "@/lib/bracket/singleElimination";';

if (!competitionSource.includes(validatorImport)) {
  const anchor =
    'import { buildTournamentCompetition } from "@/lib/competition";';

  if (!competitionSource.includes(anchor)) {
    throw new Error(
      "Could not find the CompetitionManager import anchor. No files were changed.",
    );
  }

  competitionSource = competitionSource.replace(
    anchor,
    `${anchor}\n${validatorImport}`,
  );
}

const competitionMarker = "// 0.9F.5 strict shared race-to validation";

if (!competitionSource.includes(competitionMarker)) {
  const validationPattern =
    /  function validateScores\(score1: number, score2: number\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  function finishMutator/;

  const validationReplacement = `  ${competitionMarker}
  function validateScores(score1: number, score2: number) {
    if (!isValidRaceResult(score1, score2, tournament.raceTo)) {
      setMessage(
        \`A completed race-to-\${tournament.raceTo} result must have exactly one player on \${tournament.raceTo}, with the opponent below \${tournament.raceTo}.\`,
      );
      return false;
    }

    setMessage("");
    return true;
  }

  function finishMutator`;

  if (!validationPattern.test(competitionSource)) {
    throw new Error(
      "Could not locate validateScores in CompetitionManager.tsx. No files were changed.",
    );
  }

  competitionSource = competitionSource.replace(
    validationPattern,
    validationReplacement,
  );
}

const doubleBackup = backup(doubleManagerPath, "before-0.9f5");
const competitionBackup = backup(competitionManagerPath, "before-0.9f5");

fs.writeFileSync(doubleManagerPath, doubleSource, "utf8");
fs.writeFileSync(competitionManagerPath, competitionSource, "utf8");

/* -------------------------------------------------------------------------- */
/* Verification                                                               */
/* -------------------------------------------------------------------------- */

const checks = [
  {
    file: doubleManagerPath,
    source: doubleSource,
    values: [
      "getTournament,",
      doubleMarker,
      "getDoubleEliminationLateEntrySlots(",
      "That BYE slot is no longer available",
    ],
  },
  {
    file: competitionManagerPath,
    source: competitionSource,
    values: [
      validatorImport,
      competitionMarker,
      "isValidRaceResult(score1, score2, tournament.raceTo)",
    ],
  },
];

for (const check of checks) {
  for (const value of check.values) {
    if (!check.source.includes(value)) {
      throw new Error(
        `Verification failed in ${check.file}: missing ${value}`,
      );
    }
  }
}

console.log("");
console.log("CueBracket 0.9F.5 engine stability patch applied successfully.");
console.log("");
console.log("Fixed:");
console.log("- Double-elimination late entries now use the newest saved tournament state.");
console.log("- A stale or already-used BYE slot is rejected safely.");
console.log("- Round Robin, Swiss, Leaderboard and Groups → Finals now enforce race-to scores.");
console.log("");
console.log(`Backups:`);
console.log(`- ${doubleBackup}`);
console.log(`- ${competitionBackup}`);
