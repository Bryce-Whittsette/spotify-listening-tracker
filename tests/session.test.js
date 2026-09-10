import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken } from "../src/auth/spotifyAuth.js";
import { spotifyRequest } from "../src/api/spotify.js";

const store = new Map();
globalThis.sessionStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
};
const sessionKey = "listening-tracker.session";

test("concurrent expired-token requests share one refresh and preserve refresh token", async () => {
  store.set(
    sessionKey,
    JSON.stringify({ access_token: "old", refresh_token: "refresh", expires_at: 0 }),
  );
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ access_token: "new", expires_in: 3600 }), { status: 200 });
  };
  try {
    assert.deepEqual(await Promise.all([accessToken(), accessToken(), accessToken()]), [
      "new",
      "new",
      "new",
    ]);
    assert.equal(calls, 1);
    assert.equal(JSON.parse(store.get(sessionKey)).refresh_token, "refresh");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("API 204 means no active playback", async () => {
  store.set(
    sessionKey,
    JSON.stringify({ access_token: "current", expires_at: Date.now() + 600000 }),
  );
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    assert.equal(await spotifyRequest("/me/player/currently-playing"), null);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("401 refreshes exactly once, then reports persistent rejection", async () => {
  store.set(
    sessionKey,
    JSON.stringify({
      access_token: "old",
      refresh_token: "refresh",
      expires_at: Date.now() + 600000,
    }),
  );
  let requests = 0,
    refreshes = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes("/api/token")) {
      refreshes++;
      return new Response(JSON.stringify({ access_token: "new", expires_in: 3600 }), {
        status: 200,
      });
    }
    requests++;
    return new Response(null, { status: 401 });
  };
  try {
    await assert.rejects(spotifyRequest("/me"), /authorization expired/);
    assert.equal(requests, 2);
    assert.equal(refreshes, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("429 prevents another request during Retry-After", async () => {
  store.set(
    sessionKey,
    JSON.stringify({ access_token: "current", expires_at: Date.now() + 600000 }),
  );
  let calls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
  };
  try {
    await assert.rejects(spotifyRequest("/me"), /60 seconds/);
    await assert.rejects(spotifyRequest("/me"), /rate limiting/);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
