import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSingleEliminationBracket } from "@/lib/bracket/singleElimination";
import { dashboardRows } from "@/lib/cloud/dashboard";
import type { RegistrationSettingsRow } from "@/lib/cloud/registrations";
import type { VenueTableRow } from "@/lib/cloud/tables";
import { dashboardDate, dashboardEvents, dashboardGreeting, dashboardLiveMatchCount, dashboardSafeHref, mergeDashboardRecords, upcomingDashboardEvents } from "@/lib/dashboard";
import type { League } from "@/lib/leagues";
import { DEFAULT_TOURNAMENT_OPTIONS, getBracketRounds, type Tournament } from "@/lib/tournaments";

const timestamp = "2026-08-30T08:00:00.000Z";
function tournament(overrides: Partial<Tournament> = {}): Tournament {
  return { id: "t1", name: "Mwiki Open", venue: "Club", type: "single_stage", format: "single", raceTo: 5,
    bracketSize: 4, status: "live", players: ["A", "B", "C"], options: { ...DEFAULT_TOURNAMENT_OPTIONS },
    bracket: buildSingleEliminationBracket(["A", "B", "C"], 4), createdAt: timestamp, updatedAt: timestamp, ...overrides };
}

test("dashboard greeting uses Nairobi time consistently across server and browser", () => {
  assert.equal(dashboardGreeting(new Date("2026-08-30T05:00:00Z")), "Good morning");
  assert.equal(dashboardGreeting(new Date("2026-08-30T09:00:00Z")), "Good afternoon");
  assert.equal(dashboardGreeting(new Date("2026-08-30T14:00:00Z")), "Good evening");
  assert.equal(dashboardDate("invalid"), "Date to be announced");
});

test("dashboard prioritizes live events, then drafts, then history", () => {
  const items = dashboardEvents([
    tournament({ id: "completed", status: "completed", updatedAt: "2026-08-31T08:00:00Z" }),
    tournament({ id: "draft", status: "draft" }), tournament({ id: "live" }),
  ], []);
  assert.deepEqual(items.map((item) => item.id), ["live", "draft", "completed"]);
  assert.equal(items[0].href, "/tournaments/live");
});

test("dashboard pending match counts exclude BYEs and unnamed downstream slots", () => {
  const [event] = dashboardEvents([tournament()], []);
  assert.equal(event.total, 1);
  assert.equal(event.pendingMatches, 1);
  assert.equal(event.completed, 0);
});

test("dashboard leagues include regular fixtures and playable playoffs", () => {
  const league: League = {
    id: "l1", seriesId: "series-1", clubId: null, name: "Club league", season: "Season 2", venue: "Club",
    status: "live", players: [], updatedAt: timestamp, createdAt: timestamp,
    gameType: "8-ball", raceTo: 5, format: "single-round-robin", winPoints: 3, lossPoints: 0,
    startDate: "", endDate: "", championPlayerId: null,
    fixtures: [true, false].map((completed, index) => ({ id: `f${index}`, round: 1,
      homePlayerId: "A", awayPlayerId: "B", homeScore: completed ? 5 : null, awayScore: completed ? 2 : null,
      completed, playedAt: completed ? timestamp : null })),
    playoff: { enabled: true, qualifierCount: 4, status: "live", qualifierPlayerIds: ["A", "B"], generatedAt: timestamp,
      rounds: [{ id: "r1", number: 1, name: "Final", matches: [true, false].map((ready, index) => ({
        id: `p${index}`, round: 1, position: index, player1Id: ready ? "A" : null, player2Id: ready ? "B" : null,
        seed1: null, seed2: null, score1: null, score2: null, winnerPlayerId: null, completed: false, playedAt: null,
      })) }] },
  };
  const [event] = dashboardEvents([], [league]);
  assert.equal(event.total, 3);
  assert.equal(event.completed, 1);
  assert.equal(event.pendingMatches, 2);
  assert.equal(event.href, "/leagues/l1");
});

test("merging device and cloud records keeps newer scores without crossing accounts", () => {
  const cloud = [{ id: "shared", updatedAt: timestamp }, { id: "remote", updatedAt: timestamp }];
  const local = [
    { id: "shared", updatedAt: "2026-08-30T09:00:00Z" },
    { id: "remote", updatedAt: "2026-08-29T09:00:00Z" },
    { id: "mine", updatedAt: timestamp }, { id: "other", updatedAt: timestamp }, { id: "unknown", updatedAt: timestamp },
  ];
  const merged = mergeDashboardRecords(cloud, local, "me", (id) => id === "unknown" ? null : id === "mine" ? "me" : "someone-else");
  assert.deepEqual(merged.map((item) => item.id).sort(), ["mine", "remote", "shared"]);
  assert.equal(merged.find((item) => item.id === "shared")?.updatedAt, "2026-08-30T09:00:00Z");
  assert.equal(merged.find((item) => item.id === "remote")?.updatedAt, timestamp);
});

test("live match counts deduplicate table assignments and include league matches", () => {
  const event = tournament();
  const match = getBracketRounds(event.bracket)[0].matches.find((item) => item.player1 && item.player2)!;
  match.status = "live";
  const tables = [
    { status: "playing", active_event_type: "tournament", active_event_id: event.id, active_match_id: match.id },
    { status: "playing", active_event_type: "league", active_event_id: "l1", active_match_id: "f1" },
    { status: "available", active_event_type: "league", active_event_id: "l1", active_match_id: "f2" },
  ] as VenueTableRow[];
  assert.equal(dashboardLiveMatchCount([event], tables), 2);
});

test("calendar excludes past and undated events and sorts upcoming events", () => {
  const events = [
    { tournament_id: "later", scheduled_at: "2026-09-02T08:00:00Z" },
    { tournament_id: "past", scheduled_at: "2026-08-29T08:00:00Z" },
    { tournament_id: "undated", scheduled_at: null },
    { tournament_id: "soon", scheduled_at: "2026-08-31T08:00:00Z" },
  ] as RegistrationSettingsRow[];
  assert.deepEqual(upcomingDashboardEvents(events, timestamp).map((event) => event.tournament_id), ["soon", "later"]);
});

test("dashboard paginates beyond the Data API default limit and rejects query failures", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const result = await dashboardRows(async (start, end) => ({ data: rows.slice(start, end + 1), error: null }));
  assert.equal(result.length, 1001);
  await assert.rejects(() => dashboardRows(async () => ({ data: null, error: { message: "Unavailable" } })), /Unavailable/);
});

test("notification links stay on the site", () => {
  assert.equal(dashboardSafeHref("/notifications"), "/notifications");
  assert.equal(dashboardSafeHref("/clubs/mwiki?tab=members"), "/clubs/mwiki?tab=members");
  for (const href of ["//example.com", "https://example.com", "/\\example.com", "javascript:alert(1)"]) assert.equal(dashboardSafeHref(href), "/notifications");
});

test("dashboard has authenticated account data and working club tab destinations", () => {
  const page = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");
  const component = readFileSync(new URL("../components/DashboardCommandCenter.tsx", import.meta.url), "utf8");
  const cloud = readFileSync(new URL("../lib/cloud/dashboard.ts", import.meta.url), "utf8");
  const clubPage = readFileSync(new URL("../app/clubs/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /auth\.getUser\(\)/);
  assert.match(page, /if \(!user\) redirect/);
  assert.match(cloud, /user\.id !== expectedUserId/);
  assert.match(cloud, /eq\("user_id", user\.id\)/);
  assert.doesNotMatch(cloud, /service_role/);
  for (const title of ["Continue where you stopped", "My clubs", "Coming up", "Latest notifications", "Table snapshot", "Registration requests"]) assert.ok(component.includes(title));
  assert.match(component, /setAccountValid\(false\)/);
  assert.match(component, /setData\(null\)/);
  assert.match(clubPage, /initialTab=\{tab\}/);
  assert.doesNotMatch(page, /Everything needed to run the whole pool night/);
});
