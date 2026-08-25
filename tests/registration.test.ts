import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanRegistrationName,
  mergeCheckedInPlayers,
  validateRegistrationName,
} from "../lib/registration.ts";
import { safeNextPath } from "../lib/auth/next-path.ts";

test("registration names are trimmed and internal spacing is normalized", () => {
  assert.equal(cleanRegistrationName("  The   Breaker  "), "The Breaker");
});

test("registration names enforce the public length limits", () => {
  assert.equal(validateRegistrationName("A").ok, false);
  assert.equal(validateRegistrationName("Mike").ok, true);
  assert.equal(validateRegistrationName("x".repeat(41)).ok, false);
});

test("checked-in players merge without case-insensitive duplicates", () => {
  const result = mergeCheckedInPlayers(
    ["Mike", "Sam"],
    [" mike ", "Wicky", "Sharon"],
    8,
  );

  assert.deepEqual(result.players, ["Mike", "Sam", "Wicky", "Sharon"]);
  assert.equal(result.added, 2);
  assert.equal(result.duplicates, 1);
  assert.equal(result.overflow, 0);
});

test("checked-in imports never exceed tournament capacity", () => {
  const result = mergeCheckedInPlayers(["Mike", "Sam"], ["Wicky", "Sharon"], 3);
  assert.deepEqual(result.players, ["Mike", "Sam", "Wicky"]);
  assert.equal(result.added, 1);
  assert.equal(result.overflow, 1);
});

test("authentication only returns to safe local registration paths", () => {
  assert.equal(safeNextPath("/register/event-1"), "/register/event-1");
  assert.equal(safeNextPath("//malicious.example"), "/dashboard");
  assert.equal(safeNextPath("https://malicious.example"), "/dashboard");
});
