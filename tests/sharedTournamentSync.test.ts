import assert from "node:assert/strict";
import test from "node:test";

import { sharedRosterMatchesCloud } from "@/lib/cloud/tournaments";

test("late BYE additions preserve the cloud roster before syncing", () => {
  assert.equal(sharedRosterMatchesCloud(["A", "B", "C"], ["A", "B", "C", "Late"]), true);
  assert.equal(sharedRosterMatchesCloud(["A", "B", "C"], ["A", "B", "C"]), true);
  assert.equal(sharedRosterMatchesCloud(["A", "B", "C"], ["B", "A", "C", "Late"]), false);
  assert.equal(sharedRosterMatchesCloud(["A", "B", "C"], ["A", "B"]), false);
});
