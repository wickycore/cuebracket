import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getActiveSpectatorRound,
  getSpectatorMatchState,
  matchesSpectatorFilter,
  matchesSpectatorPlayer,
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

  assert.match(source, /divide-y divide-\[#2a5680\]/);
  assert.doesNotMatch(source, /sm:grid-cols-2|xl:grid-cols-3/);
  assert.match(source, /text-base font-black leading-5/);
});

test("player search finds every match containing the requested player", () => {
  assert.equal(matchesSpectatorPlayer(match({ player1: "Wicky", player2: "Sam" }), "wick"), true);
  assert.equal(matchesSpectatorPlayer(match({ player1: "Mike", player2: "WICKY" }), " Wicky "), true);
  assert.equal(matchesSpectatorPlayer(match({ player1: "Mike", player2: "Sam" }), "Wicky"), false);
  assert.equal(matchesSpectatorPlayer(match({ player1: "Mike", winner: "Wicky" }), "Wicky"), true);
});

test("smart round opening prioritizes live, then ready, then the first unfinished round", () => {
  const rounds: BracketRound[] = [
    { round: 1, name: "Round of 16", matches: [match({ id: "r1", completed: true, player1: "A", player2: "B", winner: "A" })] },
    { round: 2, name: "Quarter Final", matches: [match({ id: "r2", round: 2, player1: "A", player2: "C" })] },
    { round: 3, name: "Semi Final", matches: [match({ id: "r3", round: 3, player1: "D", player2: "E", status: "live" })] },
    { round: 4, name: "Final", matches: [match({ id: "r4", round: 4 })] },
  ];

  assert.equal(getActiveSpectatorRound(rounds), 3);
  rounds[2].matches[0] = match({ id: "r3", round: 3 });
  assert.equal(getActiveSpectatorRound(rounds), 2);
  rounds[1].matches[0] = match({ id: "r2", round: 2 });
  assert.equal(getActiveSpectatorRound(rounds), 2);
});

test("phones default to the list while retaining a spectator's saved choice", () => {
  const source = readFileSync(
    new URL("../components/ReadOnlyBracket.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /max-width: 767px/);
  assert.match(source, /savedView === "list" \|\| savedView === "flowchart"/);
  assert.match(source, /Wide chart mode · drag sideways · pinch to zoom · double-tap to reset/);
});

test("phone list uses a single edge-to-edge gutter and keeps CueBracket controls", () => {
  const source = readFileSync(
    new URL("../components/BracketMatchList.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /-mx-3 mt-3 overflow-hidden border-y/);
  assert.match(source, /Find a player — e\.g\. Wicky/);
  assert.match(source, /Jump to round/);
});

test("flowchart removes the bulky zoom toolbar but keeps gesture navigation", () => {
  const source = readFileSync(
    new URL("../components/BracketViewport.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /Zoom out|Fit bracket to screen|Reset zoom to 100 percent|Zoom in/);
  assert.match(source, /mode: "idle" \| "pan" \| "pinch"/);
  assert.match(source, /wide chart/);
  assert.match(source, /onDoubleClick=\{\(\) => commitZoom\(1\)\}/);
});

test("spectator views use the Royal Pool Blue palette", () => {
  const listSource = readFileSync(
    new URL("../components/BracketMatchList.tsx", import.meta.url),
    "utf8",
  );
  const bracketSource = readFileSync(
    new URL("../components/ReadOnlyBracket.tsx", import.meta.url),
    "utf8",
  );

  assert.match(listSource, /bg-\[#0d2a50\]/);
  assert.match(listSource, /text-\[#fafcff\]/);
  assert.match(listSource, /bg-\[#27c2e6\] text-\[#071a35\]/);
  assert.match(listSource, /text-\[#dce8f4\]/);
  assert.match(bracketSource, /bg-\[#123763\]/);
  assert.doesNotMatch(bracketSource, /shadow-\[0_0_30px_rgba\(34,211,238/);
});
