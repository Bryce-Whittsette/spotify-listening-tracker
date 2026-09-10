const clientId = import.meta.env?.VITE_SPOTIFY_CLIENT_ID ?? "";
const redirectUri = import.meta.env?.VITE_REDIRECT_URI ?? "http://127.0.0.1:5173/";
const key = "listening-tracker.session";
const scopes = [
  "user-read-private",
  "user-read-recently-played",
  "user-top-read",
  "user-read-currently-playing",
];
let refreshPromise;
let callbackPromise;

export function isConfigured() {
  return Boolean(clientId);
}

export function randomString() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  return base64url(bytes);
}
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
export async function challengeFor(verifier) {
  return base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
}
export function validState(expected, received) {
  return typeof expected === "string" && expected.length > 0 && expected === received;
}
function readSession() {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
export function hasSession() {
  return Boolean(readSession()?.access_token);
}

async function exchange(body) {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, ...body }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Spotify authorization failed. Please sign in again.");
  const data = await response.json();
  if (
    typeof data.access_token !== "string" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0
  ) {
    throw new Error("Spotify returned an incomplete token response.");
  }
  const previous = readSession();
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? previous?.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  sessionStorage.setItem(key, JSON.stringify(session));
  return session.access_token;
}

export async function loginWithSpotify() {
  if (!clientId)
    throw new Error("Set VITE_SPOTIFY_CLIENT_ID in .env.local before connecting Spotify.");
  const verifier = randomString();
  const state = randomString();
  sessionStorage.setItem("spotify.verifier", verifier);
  sessionStorage.setItem("spotify.state", state);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    state,
    code_challenge_method: "S256",
    code_challenge: await challengeFor(verifier),
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

export function completeLogin() {
  // React StrictMode may mount twice; an authorization code is single-use.
  callbackPromise ??= (async () => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") && !params.has("error")) return hasSession();
    try {
      if (!validState(sessionStorage.getItem("spotify.state"), params.get("state"))) {
        throw new Error("The sign-in response could not be verified. Start a new sign-in.");
      }
      if (params.has("error")) throw new Error("Spotify sign-in was cancelled or denied.");
      const verifier = sessionStorage.getItem("spotify.verifier");
      if (!verifier) throw new Error("Sign-in expired. Please try again.");
      await exchange({
        grant_type: "authorization_code",
        code: params.get("code"),
        redirect_uri: redirectUri,
        code_verifier: verifier,
      });
      return true;
    } finally {
      sessionStorage.removeItem("spotify.verifier");
      sessionStorage.removeItem("spotify.state");
      window.history.replaceState({}, "", window.location.pathname);
    }
  })();
  return callbackPromise;
}

export async function accessToken(forceRefresh = false) {
  const session = readSession();
  if (!session?.access_token) throw new Error("Sign in to Spotify to continue.");
  if (!forceRefresh && session.expires_at > Date.now() + 30000) return session.access_token;
  if (!session.refresh_token) throw new Error("Your Spotify session expired. Sign in again.");
  refreshPromise ??= exchange({ grant_type: "refresh_token", refresh_token: session.refresh_token })
    .catch((error) => {
      sessionStorage.removeItem(key);
      throw error;
    })
    .finally(() => {
      refreshPromise = undefined;
    });
  return refreshPromise;
}

export function logout() {
  sessionStorage.removeItem(key);
  sessionStorage.removeItem("spotify.verifier");
  sessionStorage.removeItem("spotify.state");
  // Remove credentials left by the earlier prototype on this origin.
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_code_verifier");
  window.location.assign(window.location.pathname);
}
