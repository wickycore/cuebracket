import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  eventDateGroup,
  eventHasSpace,
  eventSearchText,
  sortDiscoveryEvents,
  type DiscoveryEvent,
} from "@/lib/events";

const base: DiscoveryEvent = {
  id: "event-1", type: "tournament", name: "Mwiki Open", clubId: "club-1",
  clubName: "Mwiki Pool Club", clubSlug: "mwiki-pool", venue: "Kasarani",
  format: "double", raceTo: 5, startsAt: "2026-09-02T15:00:00Z", endsAt: null,
  entryFee: "KES 500", capacity: 32, confirmed: 24, waitlisted: 0,
  registrationOpen: true, status: "upcoming", followed: true, href: "/register/event-1",
};

test("discovery groups dates into useful calendar windows", () => {
  const now = new Date("2026-08-29T08:00:00Z");
  assert.equal(eventDateGroup("2026-09-02T15:00:00Z", now), "week");
  assert.equal(eventDateGroup("2026-09-20T15:00:00Z", now), "later");
  assert.equal(eventDateGroup(null, now), "tba");
});

test("availability, search and chronological sorting stay deterministic", () => {
  assert.equal(eventHasSpace(base), true);
  assert.equal(eventHasSpace({ ...base, confirmed: 32 }), false);
  assert.match(eventSearchText(base), /mwiki pool club/);
  const sorted = sortDiscoveryEvents([
    { ...base, id: "tba", startsAt: null },
    { ...base, id: "later", startsAt: "2026-09-20T15:00:00Z" },
    base,
  ]);
  assert.deepEqual(sorted.map((event) => event.id), ["event-1", "later", "tba"]);
});

test("the public discovery route exposes events without internal roadmap labels", () => {
  const page = readFileSync(new URL("../app/events/page.tsx", import.meta.url), "utf8");
  const explorer = readFileSync(new URL("../components/EventDiscovery.tsx", import.meta.url), "utf8");
  const navigation = readFileSync(new URL("../components/AppHeader.tsx", import.meta.url), "utf8");
  assert.match(page, /event_registration_settings/);
  assert.match(page, /club_followers/);
  assert.match(page, /cloud_leagues/);
  assert.doesNotMatch(page, /Phase 4D/);
  assert.match(explorer, /Clubs I follow/);
  assert.match(explorer, /Spaces available/);
  assert.match(navigation, /href: "\/events"/);
});
