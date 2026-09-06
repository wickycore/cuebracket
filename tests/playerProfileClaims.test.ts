import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260906210845_verified_player_profile_claims.sql", "utf8");
const guestAction = readFileSync("components/GuestPlayerAction.tsx", "utf8");
const organizerPanel = readFileSync("components/TournamentProfileClaims.tsx", "utf8");
const guestPage = readFileSync("app/cloud/live/[id]/players/[name]/page.tsx", "utf8");

test("guest profile claims require organizer verification and never merge by name", () => {
  assert.match(migration, /create table public\.player_profile_claims/);
  assert.match(migration, /alter table public\.player_profile_claims enable row level security/);
  assert.match(migration, /private\.can_manage_tournament\(tournament_id\)/);
  assert.match(migration, /status in \('approved', 'rejected'\)/);
  assert.match(migration, /set profile_id = new\.claimant_id/);
  assert.match(migration, /and profile_id is null/);
  assert.match(migration, /Claim identity fields cannot be changed/);
  assert.match(migration, /Too many claim requests/);
  assert.doesNotMatch(migration, /lower\(.*participant_name.*\).*profile_id/is);
});

test("guest player page submits a claim and organizer has a review desk", () => {
  assert.match(guestAction, /submitPlayerProfileClaim/);
  assert.match(guestAction, /Awaiting organizer verification/);
  assert.match(guestPage, /player_profile_claims/);
  assert.match(organizerPanel, /Verify & link/);
  assert.match(organizerPanel, /never joins records just because two names match/);
});

