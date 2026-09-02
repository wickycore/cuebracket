import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the mobile drawer is inert when closed and traps keyboard focus", () => {
  const source = read("../components/AppHeader.tsx");
  assert.match(source, /inert={!menuOpen}/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /menuButtonRef\.current\?\.focus/);
});

test("public directories distinguish database failure from an empty result", () => {
  assert.match(read("../app/events/page.tsx"), /Event discovery could not load/);
  assert.match(read("../app/clubs/page.tsx"), /Club directory could not load/);
  assert.match(read("../app/clubs/[slug]/page.tsx"), /Some club information could not be loaded/);
});

test("production pages no longer expose internal phase labels or blocking alerts", () => {
  for (const path of ["../app/events/page.tsx", "../app/cloud/page.tsx"]) assert.doesNotMatch(read(path), /Phase [0-9A-Z]/);
  for (const path of ["../components/LeagueFixtures.tsx", "../components/LeaguePlayoffs.tsx", "../components/AuthNav.tsx"]) assert.doesNotMatch(read(path), /window\.alert/);
});

test("registration discloses public names and adds lightweight abuse resistance", () => {
  const source = read("../components/TournamentRegistrationForm.tsx");
  assert.match(source, /tournament name will appear publicly/i);
  assert.match(source, /registration-cooldown/);
  assert.match(source, /name="website"/);
});

test("CueBracket has branded route recovery and sharing metadata", () => {
  assert.match(read("../app/not-found.tsx"), /That shot missed the pocket/);
  assert.match(read("../app/error.tsx"), /unstable_retry/);
  assert.match(read("../app/layout.tsx"), /openGraph/);
  assert.match(read("../app/opengraph-image.tsx"), /ImageResponse/);
});
