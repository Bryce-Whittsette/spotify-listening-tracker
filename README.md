# Spotify listening tracker

A personal view of recent plays, top tracks, top artists, and current playback. Built with React and Vite. Previously named Spotify Elite DJ.

The interface keeps the listening history central: compact track lists, album artwork returned by Spotify, and plain playback status. The rotation picker is explicitly random. There is no AI recommendation model or full listening-history database.

## Try it

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open the address printed by Vite and choose **Explore a demo**. Demo tracks are fictional and are clearly marked; no Spotify account is needed.

## Connect Spotify

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Register `http://127.0.0.1:5173/` as a redirect URI, including the trailing slash.
3. Copy `.env.example` to `.env.local` and set `VITE_SPOTIFY_CLIENT_ID`. A client ID is public; **never add a client secret to a Vite application**.
4. Restart the development server and choose **Connect Spotify**. If Vite uses a different port, update both the developer dashboard and `VITE_REDIRECT_URI` to exactly match.

Spotify controls developer-mode access, eligible accounts, and available endpoints. A valid login does not guarantee access to every endpoint; each failed section reports its error. Live authorization must be verified with your own registered app before publishing a working hosted demo.

## Behavior

- Recent plays shows the latest 20 entries returned by Spotify. It is not lifetime history.
- Top lists use Spotify's affinity rankings for approximately four weeks, six months, or one year. They are not exact play counts.
- Playback checks run every 15 seconds while the tab is visible. The progress display advances locally between checks, and pauses remain paused.
- Empty playback clears the previous track. API failures are shown, including rate limits and denied endpoints.
- Refresh cancels the previous dashboard request. Polling requests do not overlap themselves and stop on unmount.
- The random picker deduplicates the available rotation before choosing a track.

## Authentication and data

Authorization uses PKCE with `crypto.getRandomValues`, SHA-256, and a checked OAuth state value. Callback handling is shared to avoid exchanging a single-use code twice under React StrictMode. Expired tokens refresh through a single shared request; a 401 triggers at most one refreshed retry.

Tokens are stored in this tab's `sessionStorage`. Browser scripts on this origin can read session storage, so deploy only reviewed code and trusted dependencies. Sign out clears local tokens. You can also revoke the app from your Spotify account settings.

The app calls Spotify directly. It has no separate tracker server, analytics service, or database. Album art loads from URLs Spotify returns. OAuth codes and state are removed from the address bar after callback handling.

Requested scopes: `user-read-private`, `user-read-recently-played`, `user-top-read`, and `user-read-currently-playing`. Playback modification and email scopes from the earlier prototype were removed because the tracker does not need them.

## Development

```sh
npm test
npm run lint
npm run build
npm run preview
```

`src/auth/spotifyAuth.js` owns authorization and session refresh. `src/api/spotify.js` handles Spotify responses and rate limits. `src/lib/listening.js` contains display and selection logic; `src/lib/demo.js` contains fictional fixtures. The UI lives in `src/App.jsx` and its stylesheet.

The test suite includes the RFC 7636 PKCE challenge vector, verifier shape, state validation, playback progress, duration formatting, and rotation deduplication. GitHub Actions runs tests, lint, and the production build. No live Spotify account is used by automated checks.

For static hosting, deploy `dist/` over HTTPS and register the exact production redirect URI. This repository does not publish or change your Spotify app automatically.

## References

- [Spotify PKCE flow](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [Token refresh](https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens)
- [Top-item time ranges](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)

MIT licensed source. Spotify music, artwork, and trademarks remain with their respective owners. This project is independent and is not endorsed by Spotify.
