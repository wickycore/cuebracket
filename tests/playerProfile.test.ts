import assert from "node:assert/strict";
import test from "node:test";

import { normalizeUsername, validatePlayerProfile } from "../lib/playerProfile.ts";

test("normalizes CueBracket usernames", () => {
  assert.equal(normalizeUsername("  Wicky_254 "), "wicky_254");
});

test("accepts a valid player profile", () => {
  const result = validatePlayerProfile({
    displayName: "Wickliff",
    username: "Wicky_254",
    tournamentName: "The Shark",
    bio: "Kasarani pool player",
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.username, "wicky_254");
});

test("rejects unsafe or ambiguous usernames", () => {
  for (const username of ["ab", "wicky-254", "wicky 254", "wicky.254"]) {
    const result = validatePlayerProfile({
      displayName: "Wickliff",
      username,
      tournamentName: "The Shark",
      bio: "",
    });
    assert.equal(result.ok, false, username);
  }
});

test("enforces tournament-name and bio limits", () => {
  assert.equal(
    validatePlayerProfile({
      displayName: "Wickliff",
      username: "wicky254",
      tournamentName: "X",
      bio: "",
    }).ok,
    false,
  );

  assert.equal(
    validatePlayerProfile({
      displayName: "Wickliff",
      username: "wicky254",
      tournamentName: "The Shark",
      bio: "x".repeat(161),
    }).ok,
    false,
  );
});
