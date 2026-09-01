import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isProtectedOrganizerPath } from "@/lib/auth/route-protection";

test("organizer header keeps native navigation inside active tournaments", () => {
  const source = readFileSync(
    new URL("../components/AppHeader.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /<Link\b/);

  for (const href of [
    "/dashboard",
    "/tournaments",
    "/leagues",
    "/clubs",
    "/tables",
    "/hall-of-champions",
    "/cloud",
  ]) {
    assert.ok(source.includes(`{ href: "${href}"`));
  }

  const nativeAnchors =
    source.match(/<a data-cb-hard-navigation="true"/g) ?? [];
  assert.ok(nativeAnchors.length >= 6);
});

test("every organizer route is locked after sign-out while spectator routes stay public", () => {
  for (const path of [
    "/dashboard",
    "/account",
    "/notifications",
    "/cloud",
    "/tournaments",
    "/tournaments/example",
    "/leagues",
    "/tables",
    "/clubs/new",
    "/clubs/example/manage",
    "/clubs/example/manage/people",
  ]) {
    assert.equal(isProtectedOrganizerPath(path), true, path);
  }
  assert.equal(isProtectedOrganizerPath("/cloud/live/example"), false);
  assert.equal(isProtectedOrganizerPath("/register/example"), false);
  assert.equal(isProtectedOrganizerPath("/clubs"), false);
  assert.equal(isProtectedOrganizerPath("/clubs/example"), false);
  assert.equal(isProtectedOrganizerPath("/"), false);
});

test("share panel generates QR codes locally and never calls an external QR service", () => {
  const source = readFileSync(
    new URL("../components/ShareTournament.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /QRCode\.toDataURL/);
  assert.doesNotMatch(source, /api\.qrserver\.com/);
});

test("completed elimination matches retain a visible correction action", () => {
  const source = readFileSync(
    new URL("../components/OrganizerMatchQueue.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Correct result/);
});
