import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { liveMatchHref, uniqueLiveMatches, validateClubGuide, type PlayerLiveMatch } from "../lib/player-following.ts";
import { isProtectedOrganizerPath } from "../lib/auth/route-protection.ts";
import { pushAllowed } from "../supabase/functions/push-notifications/policy.ts";

const match: PlayerLiveMatch = { profile_id: "player-a", event_type: "tournament", event_id: "event-a", match_key: "match-a", event_name: "Club cup", player1: "Player A", player2: "Player B", score1: 1, score2: 0, table_name: "Table 1", updated_at: "2026-08-30T10:00:00Z" };

test("following both opponents produces one watchboard card, preserving the latest score", () => {
  const latest = { ...match, profile_id: "player-b", score1: 2, updated_at: "2026-08-30T10:01:00Z" };
  assert.deepEqual(uniqueLiveMatches([match, latest]), [latest]);
  assert.equal(uniqueLiveMatches([match, { ...match, event_type: "league" }, { ...match, event_id: "another" }]).length, 3);
});

test("watch links use public routes and encode identifiers", () => {
  assert.equal(liveMatchHref(match), "/cloud/live/event-a");
  assert.equal(liveMatchHref({ ...match, event_type: "league" }), "/league/event-a");
  assert.equal(liveMatchHref({ ...match, event_id: "../event?x=1" }), "/cloud/live/..%2Fevent%3Fx%3D1");
  assert.equal(isProtectedOrganizerPath("/following"), true);
  assert.equal(isProtectedOrganizerPath("/players/player_a"), false);
});

test("club guide validation requires joining rules and enforces limits", () => {
  assert.ok(validateClubGuide("", ""));
  assert.equal(validateClubGuide("Open daily", "Respect players."), null);
  assert.ok(validateClubGuide("x".repeat(501), ""));
  assert.ok(validateClubGuide("", "x".repeat(3001)));
});

test("club tabs remain below the main header after switching sections", () => {
  const source = readFileSync(new URL("../components/ClubCommandCenter.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-label="Club sections" className="sticky top-16/);
  assert.match(source, /sm:top-\[4\.5rem\]/);
  assert.match(source, /scroll-mt-36/);
});

test("followed-player alerts have independent account preferences", () => {
  assert.equal(pushAllowed("followed_player_live", { match_alerts: false }), true);
  assert.equal(pushAllowed("followed_player_live", { followed_player_alerts: false }), false);
  assert.equal(pushAllowed("match_live", { followed_player_alerts: false }), true);
  assert.equal(pushAllowed("delivery_test", null), true);
});

test("following schema protects lists, uses public identities, deduplicates and rechecks dispatch", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260830233154_add_player_following_live_watchboards_and_club_guides.sql", import.meta.url), "utf8");
  assert.match(sql, /notify_live boolean not null default false/);
  assert.match(sql, /check\(user_id <> player_id\)/);
  for (const table of ["player_followers", "player_live_matches", "club_guides"]) assert.ok(sql.includes(`alter table public.${table} enable row level security`));
  assert.match(sql, /Only public ongoing matches/);
  assert.match(sql, /p\.is_public and p\.username is not null/);
  assert.match(sql, /on conflict\(user_id,dedupe_key\) where dedupe_key is not null do nothing/);
  assert.match(sql, /grant execute on function public\.can_deliver_player_notification\(uuid\) to service_role/);
  assert.doesNotMatch(sql, /grant (insert|update|all).*public\.player_live_matches to authenticated/);
  const edge = readFileSync(new URL("../supabase/functions/push-notifications/index.ts", import.meta.url), "utf8");
  assert.match(edge, /can_deliver_player_notification/);
  assert.ok(edge.indexOf("can_deliver_player_notification") < edge.indexOf("webpush.sendNotification"));
});
