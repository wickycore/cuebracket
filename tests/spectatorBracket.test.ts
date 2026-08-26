import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getSpectatorMatchState,
  matchesSpectatorFilter,
  numberBracketMatches,
  spectatorSourceLabel,
} from "@/lib/bracket/spectator";
import type { BracketMatch, BracketRound } from "@/lib/tournaments";

function match(overrides: Partial<BracketMatch> = {}): BracketMatch {
  return {
    id: "match-1",
    round: 1,
    position: 0,
    player1: null,
    player2: null,
    score1: null,
    score2: null,
    winner: null,
    completed: false,
    ...overrides,
  };
}

test("spectator list separates live, upcoming, finished and automatic advances", () => {
  const live = match({ player1: "Mike", player2: "Sam", status: "live" });
  const ready = match({ player1: "Mike", player2: "Sam" });
  const finished = match({ player1: "Mike", player2: "Sam", completed: true, winner: "Mike" });
  const advanced = match({ player1: "Mike", completed: true, winner: "Mike" });

  assert.equal(getSpectatorMatchState(live), "live");
  assert.equal(getSpectatorMatchState(ready), "ready");
  assert.equal(getSpectatorMatchState(finished), "finished");
  assert.equal(getSpectatorMatchState(advanced), "advanced");
  assert.equal(matchesSpectatorFilter(live, "live"), true);
  assert.equal(matchesSpectatorFilter(ready, "upcoming"), true);
  assert.equal(matchesSpectatorFilter(finished, "finished"), true);
  assert.equal(matchesSpectatorFilter(advanced, "finished"), true);
});

test("future fixtures name their feeder match instead of showing only TBD", () => {
  const rounds: BracketRound[] = [
    { round: 1, name: "Semi Final", matches: [match({ id: "semi-1" }), match({ id: "semi-2", position: 1 })] },
    { round: 2, name: "Final", matches: [match({ id: "final", round: 2, source1: { kind: "winner", matchId: "semi-1" }, source2: { kind: "winner", matchId: "semi-2" } })] },
  ];
  const numbers = numberBracketMatches(rounds);

  assert.equal(numbers.get("final"), 3);
  assert.equal(spectatorSourceLabel(rounds[1].matches[0].source1, numbers), "Winner of Match #1");
  assert.equal(spectatorSourceLabel(rounds[1].matches[0].source2, numbers), "Winner of Match #2");
});

test("spectator match list keeps one readable match per row", () => {
  const source = readFileSync(
    new URL("../components/BracketMatchList.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /divide-y divide-white\/10/);
  assert.doesNotMatch(source, /sm:grid-cols-2|xl:grid-cols-3/);
  assert.match(source, /text-base font-black leading-5/);
});
