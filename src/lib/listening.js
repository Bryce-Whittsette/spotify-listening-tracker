export function formatTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export function progressAt(playback, receivedAt, now) {
  if (!playback?.item?.duration_ms) return 0;
  const elapsed = playback.is_playing ? Math.max(0, now - receivedAt) : 0;
  return Math.min(playback.item.duration_ms, Math.max(0, playback.progress_ms ?? 0) + elapsed);
}
export function uniqueTracks(tracks) {
  const seen = new Set();
  return tracks.filter((track) => {
    if (!track?.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}
