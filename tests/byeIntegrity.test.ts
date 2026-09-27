import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDoubleEliminationBracket,
  fillDoubleEliminationByeSlot,
  getDoubleEliminationLateEntrySlots,
} from "@/lib/bracket/doubleElimination";
import {
  getFirstRoundByeCount,
  getKnockoutDrawCapacity,
  getKnockoutDrawSize,
  isDrawEditable,
} from "@/lib/bracket/drawIntegrity";
import {
  buildSingleEliminationBracket,
  countSingleEliminationAutomaticByes,
  countSingleEliminationPlayedMatches,
  fillSingleEliminationByeSlot,
  getSingleEliminationLateEntrySlots,
  updateSingleEliminationMatch,
} from "@/lib/bracket/singleElimination";
import { holdOpenByeNames } from "@/lib/bracket/spectator";
import {
  DEFAULT_TOURNAMENT_OPTIONS,
  type Tournament,
} from "@/lib/tournaments";

function players(count: number) {
  return Array.from({ length: count }, (_, index) => `P${String(index + 1).padStart(2, "0")}`);
}

function tournamentFixture(field: string[], bracketSize: number): Tournament {
  return {
    id: "bye-integrity",
    name: "BYE integrity",
    venue: "Test venue",
    type: "single_stage",
    format: "double",
    raceTo: 5,
    bracketSize,
    status: "draft",
    players: field,
    options: { ...DEFAULT_TOURNAMENT_OPTIONS },
    createdAt: "2026-09-14T00:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
  };
}

test("knockout draw size is based on entrants, not event registration capacity", () => {
  assert.equal(getKnockoutDrawSize(2), 2);
  assert.equal(getKnockoutDrawSize(13), 16);
  assert.equal(getKnockoutDrawSize(30), 32);
  assert.equal(getKnockoutDrawSize(37), 64);
  assert.equal(getKnockoutDrawSize(48), 64);
  assert.equal(getKnockoutDrawSize(64), 64);
});

test("30 entrants create a 32-player single-elimination draw with exactly two BYEs", () => {
  const bracket = buildSingleEliminationBracket(players(30));

  assert.equal(getKnockoutDrawCapacity(bracket), 32);
  assert.equal(bracket.rounds[0].matches.length, 16);
  assert.equal(countSingleEliminationAutomaticByes(bracket), 2);
  assert.equal(countSingleEliminationPlayedMatches(bracket), 0);
  assert.equal(
    bracket.rounds[0].matches.filter((match) => match.player1 && match.player2).length,
    14,
  );
});

test("48 entrants create a 64-player draw with 16 BYEs and 16 real first-round matches", () => {
  const bracket = buildSingleEliminationBracket(players(48), 48);

  assert.equal(getKnockoutDrawCapacity(bracket), 64);
  assert.equal(bracket.rounds[0].name, "Round of 64");
  assert.equal(bracket.rounds[1].name, "Round of 32");
  assert.equal(countSingleEliminationAutomaticByes(bracket), 16);
  assert.equal(
    bracket.rounds[0].matches.filter((match) => match.player1 && match.player2).length,
    16,
  );
});

test("a 48-player double-elimination event builds a complete 64-slot graph", () => {
  const bracket = buildDoubleEliminationBracket(tournamentFixture(players(48), 48));
  assert.equal(getKnockoutDrawCapacity(bracket), 64);
  assert.equal(bracket.winners[0].matches.length, 32);
  assert.equal(bracket.winners[1].matches.length, 16);
  assert.equal(bracket.winners[0].matches.filter((match) => match.player1 && match.player2).length, 16);
  assert.equal(getFirstRoundByeCount(bracket), 16);
  assert.equal(getDoubleEliminationLateEntrySlots(bracket).filter((slot) => slot.available).length, 16);
});

test("filling one single-elimination BYE changes only that bracket position", () => {
  const bracket = buildSingleEliminationBracket(players(13));
  const slot = getSingleEliminationLateEntrySlots(bracket).find((item) => item.available);
  assert.ok(slot);

  const before = bracket.rounds[0].matches.map((match) => ({
    id: match.id,
    player1: match.player1,
    player2: match.player2,
  }));
  const result = fillSingleEliminationByeSlot(bracket, slot.matchId, "Late Player");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const after = result.bracket.rounds[0].matches.map((match) => ({
    id: match.id,
    player1: match.player1,
    player2: match.player2,
  }));

  for (let index = 0; index < before.length; index += 1) {
    if (before[index].id === slot.matchId) continue;
    assert.deepEqual(after[index], before[index]);
  }
  const filled = result.bracket.rounds[0].matches.find((match) => match.id === slot.matchId);
  assert.ok(filled?.player1 === "Late Player" || filled?.player2 === "Late Player");
  assert.equal(filled?.completed, false);
  assert.equal(filled?.winner, null);
});

test("a BYE remains open until its own next match starts", () => {
  const bracket = buildSingleEliminationBracket(players(13));
  const slots = getSingleEliminationLateEntrySlots(bracket).filter((slot) => slot.available);
  assert.ok(slots.length >= 2);
  const first = slots[0];
  const feederPosition = bracket.rounds[0].matches.findIndex((match) => match.id === first.matchId);
  const nextMatch = bracket.rounds[1].matches[Math.floor(feederPosition / 2)];
  const partner = bracket.rounds[0].matches[feederPosition ^ 1];
  const ready = updateSingleEliminationMatch(bracket, partner.id, (match) => {
    match.score1 = 5;
    match.score2 = 2;
    match.winner = match.player1;
    match.completed = true;
    match.status = "finished";
  });

  const started = updateSingleEliminationMatch(ready, nextMatch.id, (match) => {
    match.status = "live";
    match.startedAt = "2026-09-27T00:00:00.000Z";
  });
  const updatedSlots = getSingleEliminationLateEntrySlots(started);
  assert.equal(updatedSlots.find((slot) => slot.matchId === first.matchId)?.available, false);
  assert.ok(updatedSlots.some((slot) => slot.available));
  assert.equal(fillSingleEliminationByeSlot(started, first.matchId, "Too Late").ok, false);
});

test("double elimination uses the same active draw sizing when generated by the manager", () => {
  const field = players(30);
  const activeDrawSize = getKnockoutDrawSize(field.length);
  const bracket = buildDoubleEliminationBracket({
    ...tournamentFixture(field, 64),
    bracketSize: activeDrawSize,
  });

  assert.equal(getKnockoutDrawCapacity(bracket), 32);
  assert.equal(getFirstRoundByeCount(bracket), 2);
  assert.equal(
    bracket.winners[0].matches.filter((match) => match.player1 && match.player2).length,
    14,
  );
});

test("double-elimination late entry fills an explicit BYE without redrawing the field", () => {
  const field = players(13);
  const bracket = buildDoubleEliminationBracket(
    tournamentFixture(field, getKnockoutDrawSize(field.length)),
  );
  const slot = getDoubleEliminationLateEntrySlots(bracket).find((item) => item.available);
  assert.ok(slot);

  const beforeIds = bracket.winners[0].matches.map((match) => match.id);
  const result = fillDoubleEliminationByeSlot(bracket, slot.matchId, "Late Double");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.deepEqual(
    result.bracket.winners[0].matches.map((match) => match.id),
    beforeIds,
  );
  const filled = result.bracket.winners[0].matches.find((match) => match.id === slot.matchId);
  assert.ok(filled?.player1 === "Late Double" || filled?.player2 === "Late Double");
  assert.equal(filled?.completed, false);
  assert.equal(filled?.winner, null);
});

test("double-elimination spectator view holds open BYE names across tournaments", () => {
  const bracket = buildDoubleEliminationBracket(
    tournamentFixture(players(13), getKnockoutDrawSize(13)),
  );
  const available = getDoubleEliminationLateEntrySlots(bracket).filter((slot) => slot.available);
  assert.ok(available.length > 0);
  const displayed = holdOpenByeNames(bracket.winners, new Set(available.map((slot) => slot.matchId)));
  const first = available[0];
  const nextMatch = displayed[1].matches.find((match) =>
    [match.source1, match.source2].some((source) => source?.kind === "winner" && source.matchId === first.matchId),
  );
  assert.ok(nextMatch);
  const sourceSlot = nextMatch.source1?.kind === "winner" && nextMatch.source1.matchId === first.matchId ? 1 : 2;
  assert.equal(sourceSlot === 1 ? nextMatch.player1 : nextMatch.player2, null);
  const original = bracket.winners[1].matches.find((match) => match.id === nextMatch.id);
  assert.equal(sourceSlot === 1 ? original?.player1 : original?.player2, first.advancingPlayer);
});

test("draw editability ends when the tournament starts", () => {
  assert.equal(isDrawEditable("draft"), true);
  assert.equal(isDrawEditable("live"), false);
  assert.equal(isDrawEditable("completed"), false);
});
