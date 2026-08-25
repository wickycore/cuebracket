import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
