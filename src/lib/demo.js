// Fictional records, deliberately separated from real Spotify responses.
const tracks = [
  "Night Window",
  "After the Rain",
  "Blue Hour",
  "Side Street",
  "Still Moving",
  "Last Train",
].map((name, i) => ({
  id: `demo-${i}`,
  name,
  artists: [{ name: ["Northline", "Ada Vale", "Slow Current"][i % 3] }],
  album: { name: "Example recordings", images: [] },
  duration_ms: 180000 + i * 10000,
}));
export const demo = {
  profile: { display_name: "Demo listener" },
  recent: {
    items: tracks.map((track, i) => ({
      track,
      played_at: new Date(Date.UTC(2026, 8, 1, 18, 30 - i * 4)).toISOString(),
    })),
  },
  tracks: { items: tracks },
  artists: {
    items: ["Northline", "Ada Vale", "Slow Current"].map((name, i) => ({
      id: `artist-${i}`,
      name,
      images: [],
    })),
  },
  playback: { item: tracks[0], progress_ms: 48000, is_playing: false },
};
