import { accessToken } from "../auth/spotifyAuth.js";

let rateLimitUntil = 0;

export async function spotifyRequest(endpoint, { signal } = {}) {
  if (!endpoint.startsWith("/") || endpoint.startsWith("//")) throw new Error("Invalid API path.");
  if (Date.now() < rateLimitUntil)
    throw new Error("Spotify is rate limiting requests. Please wait before refreshing.");
  const request = async (forceRefresh) =>
    fetch(`https://api.spotify.com/v1${endpoint}`, {
      headers: { Authorization: `Bearer ${await accessToken(forceRefresh)}` },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  let response = await request(false);
  if (response.status === 401) response = await request(true);
  if (response.status === 204) return null;
  if (response.status === 429) {
    const retry = Number(response.headers.get("Retry-After"));
    const seconds = Number.isFinite(retry) && retry > 0 ? retry : 60;
    rateLimitUntil = Date.now() + seconds * 1000;
    throw new Error(`Spotify rate limit reached. Try again in ${Math.ceil(seconds)} seconds.`);
  }
  if (response.status === 403)
    throw new Error("Spotify denied this feature. Check app access and account eligibility.");
  if (response.status === 401)
    throw new Error("Spotify authorization expired. Sign out and reconnect.");
  if (!response.ok)
    throw new Error(`Spotify request failed (${response.status}). Try again shortly.`);
  return response.json();
}

export const getProfile = (options) => spotifyRequest("/me", options);
export const getRecentlyPlayed = (options) =>
  spotifyRequest("/me/player/recently-played?limit=20", options);
export const getTopTracks = (range, options) =>
  spotifyRequest(`/me/top/tracks?limit=20&time_range=${encodeURIComponent(range)}`, options);
export const getTopArtists = (range, options) =>
  spotifyRequest(`/me/top/artists?limit=10&time_range=${encodeURIComponent(range)}`, options);
export const getNowPlaying = (options) => spotifyRequest("/me/player/currently-playing", options);
