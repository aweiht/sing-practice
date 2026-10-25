// Pitch helpers shared by the lane, the take page and history. MIDI note numbers throughout (60 = C4).
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export const noteName = (m: number) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);

/** Signed cents error with octave errors forgiven, in [-600, 600). */
export const fold = (cents: number) => ((((cents + 600) % 1200) + 1200) % 1200) - 600;

/** Same rule as the engine's scoring: full credit within 50 cents, none beyond 150. */
export const credit = (err: number) => Math.max(0, Math.min(1, (150 - Math.abs(err)) / 100));

export type Grade = "good" | "close" | "off" | "none";
export const grade = (err: number): Grade =>
  Number.isNaN(err) ? "none" : Math.abs(err) <= 50 ? "good" : Math.abs(err) <= 100 ? "close" : "off";

export const COLORS: Record<Grade, string> = { good: "#34d27b", close: "#f5b83d", off: "#f2626b", none: "#8b94ab" };

/** The app a track plays in, from its id. */
export const sourceName = (trackId: string) =>
  trackId.startsWith("music:") ? "Apple Music" : trackId.startsWith("youtube:") ? "YouTube" : "Spotify";

export const clock = (s: number) => {
  const t = Math.max(0, s);
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
};

/** Median of the defined values around frame f; steadies a pitch line without adding lag. */
export function smoothed(get: (f: number) => number, f: number, w = 3) {
  const v: number[] = [];
  for (let d = -w; d <= w; d++) {
    const x = get(f + d);
    if (!Number.isNaN(x)) v.push(x);
  }
  if (v.length < w) return NaN;
  v.sort((a, b) => a - b);
  return v[v.length >> 1];
}

export function scoreWord(score: number) {
  return score >= 90 ? "非常出色" : score >= 80 ? "很棒" : score >= 65 ? "不错" : score >= 45 ? "继续进步" : "继续练习";
}

export function when(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
