# Contributing

Thanks for helping improve the Spotify listening tracker.

## Local setup

Use Node.js 22.13 or newer.

```sh
npm ci
npm test
npm run lint
npm run build
npm run dev -- --host 127.0.0.1
```

Use **Explore a demo** for routine development. Automated tests must not depend on a live Spotify account.

## Authentication and privacy

Never add a Spotify client secret to this browser application. Keep tokens and OAuth codes out of commits, logs, screenshots, and fixtures. Preserve PKCE, OAuth state validation, single-use callback handling, and bounded token refresh behavior when changing authentication.

## Pull requests

Add or update tests for changes to authentication, playback progress, formatting, or rotation selection. Exercise loading, empty, denied-scope, rate-limit, and signed-out states for UI changes. Run all checks above, update `README.md` for user-facing behavior, and add a concise entry under **Unreleased** in `CHANGELOG.md`.

Pull requests should describe the user-visible result, test evidence, and any changes to requested scopes, redirect URIs, storage, or Spotify API usage.
