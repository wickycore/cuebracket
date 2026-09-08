import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  compactSpectatorRounds,
  getAutomaticAdvanceCount,
  getActiveSpectatorRound,
  getSpectatorMatchState,
  matchesSpectatorFilter,
  matchesSpectatorPlayer,
  numberBracketMatches,
  spectatorSourceLabel,
} from "@/lib/bracket/spectator";
import type { BracketMatch, BracketRound } from "@/lib/tournaments";
import { buildTournamentPlayerCard, shortRoundName } from "@/lib/bracket/player-card";
import { normalizeParticipantName, participantProfilePath } from "@/lib/cloud/public-participants";

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

test("spectator views compact repeated BYEs without changing bracket data", () => {
  const opening: BracketRound = {
    round: 1,
    name: "Round of 64",
    matches: [
      match({ id: "bye-1", player1: "Sam", completed: true, winner: "Sam" }),
      match({ id: "bye-2", position: 1, player1: "Peter", completed: true, winner: "Peter" }),
      match({ id: "play-1", position: 2, player1: "Mike", player2: "Ben" }),
    ],
  };
  const later: BracketRound = { round: 2, name: "Round of 32", matches: [match({ id: "next", round: 2 })] };
  const rounds = [opening, later];
  const compacted = compactSpectatorRounds(rounds);

  assert.equal(getAutomaticAdvanceCount(opening), 2);
  assert.deepEqual(compacted[0].matches.map((item) => item.id), ["play-1"]);
  assert.equal(compacted[0].matches[0].position, 0);
  assert.equal(compacted[1], later);
  assert.equal(rounds[0].matches.length, 3);
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

test("flowchart cards use feeder match labels for unresolved players", () => {
  const source = readFileSync(
    new URL("../components/ReadOnlyBracket.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /spectatorSourceLabel\(source, sectionMatchNumbers\)/);
  assert.match(source, /index === 0 \? match\.source1 : match\.source2/);
  assert.match(source, /sectionMatchNumbers\.get\(match\.id\)/);
  assert.match(source, /`Match #\$\{matchNumber\}`/);
  assert.doesNotMatch(source, /playerPlaceholders\?\.\[index\] \?\? "TBD"/);
});

test("spectator match list uses compact expandable one-line rows", () => {
  const source = readFileSync(
    new URL("../components/BracketMatchList.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /grid min-h-14 w-full/);
  assert.doesNotMatch(source, /sm:grid-cols-2|xl:grid-cols-3/);
  assert.match(source, /function ChevronIcon/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /<Score score=\{match\.score1\}/);
  assert.doesNotMatch(source, /playerInitials|avatarStyles/);
  assert.match(source, /selectedMatchId|expandedMatchId/);
  assert.match(source, /Race to \{matchRaceTo\}/);
  assert.doesNotMatch(source, /Best of/);
});

test("player rows resolve registered profiles while guests receive tournament-only cards", () => {
  const rounds: BracketRound[] = [
    {
      round: 1,
      name: "Round of 16",
      matches: [match({ id: "m1", player1: "Sammy", player2: "Colo", score1: 5, score2: 3, completed: true, winner: "Sammy" })],
    },
    {
      round: 2,
      name: "Quarter Final",
      matches: [match({ id: "m2", round: 2, player1: "Sammy", player2: "Ouma", status: "live", score1: 2, score2: 1 })],
    },
  ];
  const card = buildTournamentPlayerCard(rounds, " sammy ");

  assert.equal(card?.wins, 1);
  assert.equal(card?.losses, 0);
  assert.equal(card?.latestRound, "QF");
  assert.deepEqual(card?.matches.map((item) => item.outcome), ["win", "live"]);
  assert.equal(shortRoundName("Round of 32"), "R32");
  assert.equal(normalizeParticipantName("  SAMMY   JOE "), "sammy joe");
  assert.equal(participantProfilePath({ displayName: "Sammy", profileId: "abc", username: "sammy_8", avatarUrl: null }), "/players/sammy_8");
});

test("public spectator player navigation is privacy-safe and does not merge guests by name", () => {
  const list = readFileSync(new URL("../components/BracketMatchList.tsx", import.meta.url), "utf8");
  const guestPage = readFileSync(new URL("../app/cloud/live/[id]/players/[name]/page.tsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20260906123000_public_participant_projection.sql", import.meta.url), "utf8");

  assert.match(list, /participantProfilePath\(participant\)/);
  assert.match(list, /\/cloud\/live\/\$\{encodeURIComponent\(tournamentId\)\}\/players\//);
  assert.match(list, /onOpenPlayer\(match\.player1!\)/);
  assert.match(guestPage, /Guest records are never merged by name alone/);
  assert.match(guestPage, /Invite \{playerName\} to CueBracket|GuestPlayerAction/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /tournament\.is_public/);
  assert.match(migration, /profile\.is_public/);
  assert.match(migration, /registration\.status in \('approved', 'checked_in'\)/);
  assert.match(migration, /revoke all on table public\.public_tournament_participants/);
  assert.match(migration, /drop function if exists public\.get_public_tournament_participants/);
});

test("flowchart player names and BYE chevrons open the same registered or guest profiles as list view",()=>{
  const source=readFileSync(new URL("../components/ReadOnlyBracket.tsx",import.meta.url),"utf8");
  assert.match(source,/participantProfilePath\(participant\)/);
  assert.match(source,/cloud\/live\/\$\{encodeURIComponent\(tournamentId\)\}\/players/);
  assert.match(source,/Open \$\{player\} player profile/);
  assert.match(source,/Open \$\{advancingPlayer\} player profile/);
  assert.match(source,/participants=\{publicParticipants\}/);
});

test("cloud spectator view server-renders details and exposes recovery states", () => {
  const page = readFileSync(new URL("../app/cloud/live/[id]/page.tsx", import.meta.url), "utf8");
  const realtime = readFileSync(new URL("../components/RealtimeCloudTournament.tsx", import.meta.url), "utf8");
  const cloud = readFileSync(new URL("../lib/cloud/tournaments.ts", import.meta.url), "utf8");
  const socialImage = readFileSync(new URL("../app/cloud/live/[id]/opengraph-image.tsx", import.meta.url), "utf8");

  assert.match(page, /getPublicTournamentSnapshot/);
  assert.match(page, /generateMetadata/);
  assert.match(page, /initialRow=\{snapshot\.row\}/);
  assert.match(realtime, /LOAD_TIMEOUT_MS/);
  assert.match(realtime, /Tournament not found/);
  assert.match(realtime, /You’re offline/);
  assert.match(realtime, /Retry connection/);
  assert.match(realtime, /Tournament not started yet/);
  assert.doesNotMatch(realtime, /Final results/);
  assert.match(cloud, /\.eq\("is_public", true\)/);
  assert.match(realtime, /if \(!nextRow\.is_public\)/);
  assert.match(socialImage, /ImageResponse/);
  assert.match(socialImage, /CUEBRACKET LIVE/);
});

test("spectator match cards use compact desktop geometry", () => {
  const list = readFileSync(new URL("../components/BracketMatchList.tsx", import.meta.url), "utf8");
  const flowchart = readFileSync(new URL("../components/ReadOnlyBracket.tsx", import.meta.url), "utf8");

  assert.match(list, /grid min-h-14 w-full/);
  assert.match(list, /flex min-h-12 w-full/);
  assert.match(flowchart, /const matchHeight = 94/);
  assert.match(flowchart, /const matchPitch = 110/);
  assert.match(flowchart, /className="w-48 shrink-0 snap-start"/);
});

test("automatic advances use one slim BYE line in list and flowchart views", () => {
  const list = readFileSync(
    new URL("../components/BracketMatchList.tsx", import.meta.url),
    "utf8",
  );
  const flowchart = readFileSync(
    new URL("../components/ReadOnlyBracket.tsx", import.meta.url),
    "utf8",
  );

  assert.match(list, /const advancingPlayer = match\.player1 \?\? match\.player2 \?\? match\.winner/);
  assert.match(list, /\{advancingPlayer\}<\/span>[\s\S]*advances · BYE/);
  assert.match(list, /advances · BYE/);
  assert.match(list, /flex min-h-12 w-full/);
  assert.doesNotMatch(list, /BYE<\/strong> — No opponent/);
  assert.doesNotMatch(list, /Automatic advance<\/strong> · no match played/);
  assert.match(flowchart, /\{advancingPlayer\} advances · BYE/);
  assert.match(flowchart, /flex h-9 items-center justify-center/);
  assert.doesNotMatch(flowchart, />Automatic BYE</);
  assert.doesNotMatch(flowchart, />No opponent</);
});

test("flowchart shows a shared race target once in each round heading", () => {
  const source = readFileSync(
    new URL("../components/ReadOnlyBracket.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const sharedRoundRace = roundRaceTargets\.length === 1/);
  assert.match(source, /`RT\$\{sharedRoundRace\}`/);
  assert.match(source, /aria-label=\{sharedRoundRace \? `Race to \$\{sharedRoundRace\}`/);
  assert.match(source, /sharedRoundRace \? "" : `Race to \$\{matchRaceTo\}`/);
});

test("list view pins a concise round heading with playable progress", () => {
  const source = readFileSync(
    new URL("../components/BracketMatchList.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /sticky top-0 z-20/);
  assert.match(source, /const playableMatches = round\.matches\.filter/);
  assert.match(source, /\{completed\}\/\{playableMatches\.length\} done/);
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
  assert.match(source, /\[scrollbar-width:none\]/);
  assert.match(source, /\[&::\-webkit-scrollbar\]:hidden/);
  assert.match(source, /sticky bottom-0 z-20/);
  assert.match(source, />Not started<|>Live<|>Finished<|>BYE</);
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

test("spectator list uses the match-card palette while the flowchart stays Royal Pool Blue", () => {
  const listSource = readFileSync(
    new URL("../components/BracketMatchList.tsx", import.meta.url),
    "utf8",
  );
  const bracketSource = readFileSync(
    new URL("../components/ReadOnlyBracket.tsx", import.meta.url),
    "utf8",
  );

  assert.match(listSource, /bg-\[#08172a\]/);
  assert.match(listSource, /text-\[#f8fbff\]/);
  assert.match(listSource, /bg-\[#102a49\]/);
  assert.match(listSource, /bg-\[#39a8ff\]/);
  assert.match(bracketSource, /bg-\[#123763\]/);
  assert.doesNotMatch(bracketSource, /shadow-\[0_0_30px_rgba\(34,211,238/);
});

test("the entire phone website uses the approved 75-percent density at normal zoom", () => {
  const source = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /@media \(max-width: 639px\)[\s\S]*html \{[\s\S]*font-size: 75%;/);
  assert.match(source, /input,[\s\S]*select,[\s\S]*textarea \{[\s\S]*font-size: 1rem;/);
});
