import { useCallback, useEffect, useRef, useState } from "react";
import {
  loginWithSpotify,
  completeLogin,
  hasSession,
  isConfigured,
  logout,
} from "./auth/spotifyAuth";
import {
  getProfile,
  getRecentlyPlayed,
  getTopTracks,
  getTopArtists,
  getNowPlaying,
} from "./api/spotify";
import { formatTime, progressAt, uniqueTracks } from "./lib/listening";
import { demo } from "./lib/demo";
import "./App.css";

const ranges = { short_term: "Past 4 weeks", medium_term: "Past 6 months", long_term: "Past year" };
const names = ["Profile", "Recent plays", "Top tracks", "Top artists", "Playback"];
const artists = (track) =>
  track?.artists?.map((artist) => artist.name).join(", ") || "Unknown artist";

function TrackRow({ track, index, playedAt }) {
  if (!track) return null;
  const art = track.album?.images?.at(-1)?.url;
  return (
    <li className="track-row">
      <span className="rank">{String(index + 1).padStart(2, "0")}</span>
      {art ? (
        <img src={art} alt="" loading="lazy" />
      ) : (
        <span className="art-placeholder" aria-hidden="true">
          ♪
        </span>
      )}
      <div className="track-copy">
        {track.external_urls?.spotify ? (
          <a href={track.external_urls.spotify} target="_blank" rel="noreferrer">
            {track.name}
          </a>
        ) : (
          <strong>{track.name}</strong>
        )}
        <span>{artists(track)}</span>
      </div>
      <span className="track-time">
        {playedAt ? (
          <time dateTime={playedAt}>
            {new Date(playedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </time>
        ) : (
          formatTime(track.duration_ms)
        )}
      </span>
    </li>
  );
}

export default function App() {
  const [signedIn, setSignedIn] = useState(hasSession);
  const [demoMode, setDemoMode] = useState(false);
  const [range, setRange] = useState("short_term");
  const [data, setData] = useState({ profile: null, recent: [], tracks: [], artists: [] });
  const [playback, setPlayback] = useState(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [updated, setUpdated] = useState(null);
  const [pick, setPick] = useState(null);
  const activeRequest = useRef(null);
  const active = signedIn || demoMode;

  useEffect(() => {
    let cancelled = false;
    completeLogin()
      .then((value) => {
        if (!cancelled) setSignedIn(value);
      })
      .catch((error) => {
        if (!cancelled) setErrors([error.message]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setErrors([]);
    const options = { signal: controller.signal };
    const results = demoMode
      ? [demo.profile, demo.recent, demo.tracks, demo.artists, demo.playback].map((value) => ({
          status: "fulfilled",
          value,
        }))
      : await Promise.allSettled([
          getProfile(options),
          getRecentlyPlayed(options),
          getTopTracks(range, options),
          getTopArtists(range, options),
          getNowPlaying(options),
        ]);
    if (controller.signal.aborted) return;
    const failures = results.flatMap((result, index) =>
      result.status === "rejected" ? [`${names[index]}: ${result.reason.message}`] : [],
    );
    setErrors(failures);
    const value = (index) => (results[index].status === "fulfilled" ? results[index].value : null);
    setData({
      profile: value(0),
      recent: value(1)?.items ?? [],
      tracks: value(2)?.items ?? [],
      artists: value(3)?.items ?? [],
    });
    setPlayback(value(4));
    setReceivedAt(Date.now());
    setUpdated(failures.length === 5 ? null : new Date());
    setLoading(false);
  }, [demoMode, range]);

  useEffect(() => {
    if (!active) return;
    // Schedule initialization outside the effect's synchronous render phase.
    const timer = setTimeout(() => {
      void refresh();
    }, 0);
    return () => {
      clearTimeout(timer);
      activeRequest.current?.abort();
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!signedIn || demoMode) return;
    let cancelled = false;
    let timer;
    const controller = new AbortController();
    async function poll() {
      if (cancelled) return;
      if (!document.hidden) {
        try {
          const live = await getNowPlaying({ signal: controller.signal });
          if (!cancelled) {
            setPlayback(live);
            setReceivedAt(Date.now());
            setErrors((previous) => previous.filter((message) => !message.startsWith("Playback:")));
          }
        } catch (error) {
          if (!cancelled)
            setErrors((previous) => [
              ...previous.filter((message) => !message.startsWith("Playback:")),
              `Playback: ${error.message}`,
            ]);
        }
      }
      if (!cancelled) timer = setTimeout(poll, 15000);
    }
    timer = setTimeout(poll, 15000);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [signedIn, demoMode]);

  useEffect(() => {
    if (!playback?.is_playing) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [playback?.is_playing]);

  const position = progressAt(playback, receivedAt, clock);
  const track = playback?.item;
  async function connect() {
    try {
      await loginWithSpotify();
    } catch (error) {
      setErrors([error.message]);
    }
  }

  return (
    <main className="app">
      <header className="masthead">
        <div>
          <p className="eyebrow">Listening tracker</p>
          <h1>Your rotation.</h1>
          <p>
            {active
              ? demoMode
                ? "Demo library · fictional tracks"
                : data.profile?.display_name || "Your Spotify library"
              : "Recent plays, favorite artists, and what’s on now."}
          </p>
        </div>
        <div className="header-actions">
          {active && (
            <>
              <button disabled={loading} onClick={refresh}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              <button onClick={() => (demoMode ? (setDemoMode(false), setErrors([])) : logout())}>
                {demoMode ? "Exit demo" : "Sign out"}
              </button>
            </>
          )}
        </div>
      </header>
      {errors.length > 0 && (
        <div className="error" role="alert">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
      {!active ? (
        <section className="login">
          <h2>A closer look at your listening.</h2>
          <p>
            Connect Spotify to see your recent plays and top tracks. Your account stays under your
            control; this tracker only reads listening data.
          </p>
          <div className="login-actions">
            <button className="primary" onClick={connect}>
              Connect Spotify
            </button>
            <button
              onClick={() => {
                setDemoMode(true);
                setErrors([]);
              }}
            >
              Explore a demo
            </button>
          </div>
          {!isConfigured() && (
            <p className="setup-note">
              Local setup: copy .env.example to .env.local and add your Spotify developer client ID.
            </p>
          )}
          <p className="secondary">
            Tokens are kept in this tab’s session storage. No listening data is sent to a separate
            tracker server.
          </p>
        </section>
      ) : (
        <>
          {demoMode && (
            <p className="demo-banner">
              Demo mode uses fictional records. Connecting Spotify replaces them with your own data.
            </p>
          )}
          <section className="now-playing" aria-label="Current playback">
            <p className="eyebrow">
              {track ? (playback.is_playing ? "Now playing" : "Paused") : "Playback"}
            </p>
            {track ? (
              <div className="now-layout">
                {track.album?.images?.[0]?.url ? (
                  <img src={track.album.images[0].url} alt="" />
                ) : (
                  <div className="cover-placeholder" aria-hidden="true">
                    ♪
                  </div>
                )}
                <div>
                  <h2>{track.name}</h2>
                  <p>{artists(track)}</p>
                  <progress
                    aria-label="Track progress"
                    max={track.duration_ms || 1}
                    value={position}
                  />
                  <div className="progress-time">
                    <span>{formatTime(position)}</span>
                    <span>{formatTime(track.duration_ms)}</span>
                  </div>
                  {track.external_urls?.spotify && (
                    <a href={track.external_urls.spotify} target="_blank" rel="noreferrer">
                      Open in Spotify ↗
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p>
                {loading
                  ? "Checking playback…"
                  : "Nothing is playing. Start a track in Spotify; this view checks every 15 seconds."}
              </p>
            )}
          </section>
          <div className="library-heading">
            <h2>Listening history</h2>
            <label>
              Top lists
              <select
                value={range}
                onChange={(event) => setRange(event.target.value)}
                disabled={demoMode || loading}
              >
                {Object.entries(ranges).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="music-grid">
            <section>
              <div className="list-heading">
                <h3>Recent plays</h3>
                <span>Latest 20 returned by Spotify</span>
              </div>
              <ol>
                {data.recent
                  .filter((item) => item.track)
                  .map((item, index) => (
                    <TrackRow
                      key={`${item.played_at}-${index}`}
                      track={item.track}
                      playedAt={item.played_at}
                      index={index}
                    />
                  ))}
              </ol>
              {!data.recent.length && (
                <p className="empty">{loading ? "Loading…" : "No recent plays available."}</p>
              )}
            </section>
            <section>
              <div className="list-heading">
                <h3>Top tracks</h3>
                <span>{demoMode ? "Example ranking" : ranges[range]}</span>
              </div>
              <ol>
                {data.tracks.map((item, index) => (
                  <TrackRow key={item.id ?? index} track={item} index={index} />
                ))}
              </ol>
              {!data.tracks.length && (
                <p className="empty">{loading ? "Loading…" : "No top tracks available."}</p>
              )}
            </section>
          </div>
          <section className="artists">
            <h3>Top artists</h3>
            <ol>
              {data.artists.map((artist, index) => (
                <li key={artist.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {artist.external_urls?.spotify ? (
                    <a href={artist.external_urls.spotify} target="_blank" rel="noreferrer">
                      {artist.name}
                    </a>
                  ) : (
                    <strong>{artist.name}</strong>
                  )}
                </li>
              ))}
            </ol>
            {!data.artists.length && <p className="empty">No artist ranking available.</p>}
          </section>
          <section className="rediscover">
            <div>
              <h3>Pick something from your rotation</h3>
              <p>A random selection from the tracks above.</p>
            </div>
            <button
              disabled={!data.tracks.length && !data.recent.length}
              onClick={() => {
                const pool = uniqueTracks([
                  ...data.tracks,
                  ...data.recent.map((item) => item.track),
                ]);
                setPick(pool[Math.floor(Math.random() * pool.length)] ?? null);
              }}
            >
              Pick a track
            </button>
            {pick && (
              <ol>
                <TrackRow track={pick} index={0} />
              </ol>
            )}
          </section>
          <p className="updated" role="status">
            {loading
              ? "Loading Spotify data…"
              : updated
                ? `Last refresh ${updated.toLocaleTimeString()}${errors.length ? " · Some sections are unavailable" : ""}`
                : "Waiting for data."}
          </p>
        </>
      )}
      <footer>
        <span>Independent project using the Spotify Web API.</span>
        <span>Top lists are Spotify rankings, not exact play counts.</span>
      </footer>
    </main>
  );
}
