import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime, progressAt, uniqueTracks } from "../src/lib/listening.js";
import { challengeFor, randomString, validState } from "../src/auth/spotifyAuth.js";

test("PKCE challenge matches RFC 7636 test vector", async () => {
  assert.equal(
    await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
  );
});
test("verifiers use the PKCE alphabet and adequate length", () => {
  const values = new Set(Array.from({ length: 100 }, randomString));
  assert.equal(values.size, 100);
  for (const value of values) assert.match(value, /^[A-Za-z0-9_-]{64}$/);
});
test("state requires a nonempty exact match", () => {
  assert.ok(validState("abc", "abc"));
  for (const pair of [
    [null, null],
    ["", ""],
    ["abc", "def"],
    ["abc", null],
  ])
    assert.equal(validState(...pair), false);
});
test("paused playback stays fixed and active playback cannot exceed duration", () => {
  const track = { item: { duration_ms: 120000 }, progress_ms: 30000, is_playing: false };
  assert.equal(progressAt(track, 1000, 6000), 30000);
  assert.equal(progressAt({ ...track, is_playing: true }, 1000, 6000), 35000);
  assert.equal(progressAt({ ...track, is_playing: true }, 0, 999999), 120000);
  assert.equal(progressAt(null, 0, 1), 0);
});
test("duration formatter handles invalid values", () => {
  assert.equal(formatTime(125000), "2:05");
  assert.equal(formatTime(NaN), "0:00");
  assert.equal(formatTime(-10), "0:00");
});
test("rotation picker deduplicates tracks and ignores unavailable records", () => {
  assert.deepEqual(uniqueTracks([null, { id: "a" }, { id: "a" }, { id: "b" }]), [
    { id: "a" },
    { id: "b" },
  ]);
});
