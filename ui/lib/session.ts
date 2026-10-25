"use client";
// The live session, fed by the engine's Server-Sent Events (/events).
// Pitch frames (10 ms) live in plain arrays read by the canvas every frame; React only sees the slow-moving
// parts (song, takes, status, score) through useSession().
import { useEffect, useSyncExternalStore } from "react";
import { learnNow, learnTakes } from "./learnState";
import { updateArrived } from "./perf";
export { firstPlayGoing, learnNow, learnOf } from "./learnState";

/** The longest the notes stay dimmed while the place is being confirmed (Live.lockDim). */
const LOCK_DIM_MAX_MS = 12000;
/** A pause from singing this long counts as resting the voice: the singing time starts again. */
const REST_RESETS_MS = 20 * 60_000;

export type Track = { id: string; name: string; artist: string; album: string; duration: number; art?: string | null;
                      /** the song's Apple Music page, when its cover came from Apple (iTunes Search or Shazam) */
                      link?: string | null };
export type Bar = [number, number, number]; // [start frame, end frame, midi]
export type Take = { name: string; artist: string; track_id?: string; status: "learning" | "scoring" | "done" | "learned" | "partly" | "failed";
                     score: number | null; live: number | null; report: string | null; notes_hit?: number | null; notes_total?: number | null;
                     mode?: "learn" | "sing"; blind?: boolean; ready?: boolean; learned?: number };
/** `player`: the music app being followed (Spotify, Apple Music or YouTube) and what it's playing.
 *  `youtube_blocked`: YouTube is playing in a browser that won't let OnKey read the page, and where to allow it.
 *  `browser_sounding`: YouTube is off and a browser plays sound: which, and whether turning YouTube on would let
 *  OnKey sing along to it (Firefox and Arc only when listening).
 *  `mic`, `audio`: the microphone's and system audio recording's permission. `automation_denied`: the app macOS
 *  won't let OnKey control. `models`: whether new songs can be learned (the learning models are there).
 *  `music_quiet`: the music app plays but OnKey hears it only very faintly (its own volume turned right down).
 *  `mic_device`: the microphone OnKey listens to (the same one setup's mic check used); null: none connected.
 *  `output_ms`: how long after the music app plays you hear it, as allowed for; `output`: the output device and
 *  its timing check (see OutputTiming). */
export type Status = { echo_cancel?: boolean; player: null | { state: string; name: string; artist: string; app: string }; output_ms?: number;
                       output?: OutputTiming;
                       youtube_blocked?: null | { browser: string; setting: string }; youtube?: boolean; listening?: boolean;
                       browser_sounding?: null | { browser: string; works: boolean };
                       mic?: Perm; audio?: Perm; automation_denied?: string | null; not_answering?: string | null; mic_device?: string | null;
                       music_quiet?: null | { app: string; level_db: number; volume?: number | null };
                       models?: { state: "ready" | "missing"; error?: string } };

/** What listening mode is doing, in words. `kind`: "finding" (music heard, being named), "new_song" (the song
 *  changed, the next being named), "unnamed" (couldn't name it), "no_shazam" (only songs learned here are
 *  recognised), "shazam_off" (not a song learned here, and Shazam is switched off), "learning" (a first play of the
 *  song shown). */
export type Line = { kind: "finding" | "new_song" | "unnamed" | "no_shazam" | "shazam_off" | "podcast" | "learning" | "elsewhere"; text: string };

/** A song being learned (src-tauri/src/progress.rs): its stage and how much of the whole learn is done (0..1),
 *  from the work actually done (music separated, words timed, bars made); `fraction` is null while the song still
 *  plays. "waiting": its turn for the separation models; "queued": the song ended and waits to be learned while a song
 *  before it is (one is learned at a time: its fraction doesn't move, so it isn't shown, learnPct); "paused":
 *  waiting while you sing a learned song. */
export type LearnJob = { track_id: string; name: string; artist: string; fraction: number | null;
                         stage: "playing" | "waiting" | "queued" | "paused" | "separating" | "pitch" | "scoring" | "words" | "bars" | "notes" | "saving" };

/** How early (s) each lyric line (and the upcoming-line preview under it) shows before its sung time. Learned
 *  plays store line times on the singing (median +0.02..+0.05 s, bench/lyrics-late), so 0.15 s felt late; first
 *  plays (LRCLIB's times) showed lines ~0.75 s early, and early reads better than late. Only the line change uses
 *  it: the word fill and the note bars stay on the singing. The align eval's "right line showing" uses the same. */
export const LINE_LEAD = 0.4;

const LEARN_STAGE: Record<LearnJob["stage"], string> = {
  playing: "播放时学习歌曲", waiting: "等待处理", queued: "排队等待学习", paused: "练习期间暂停", separating: "分离人声", pitch: "提取旋律",
  scoring: "评估本次练习", words: "对齐歌词", bars: "生成音符轨迹", notes: "识别音符", saving: "正在保存",
};
/** What a learn is doing, in words. */
export const learnStage = (j: LearnJob) => LEARN_STAGE[j.stage] ?? "正在学习";
/** How much of the learn is done, as a whole percentage; null while the song plays, or while it waits to be learned
 *  behind another song (a percentage standing still for minutes read as stuck). */
export const learnPct = (j: LearnJob) => j.fraction == null || j.stage === "queued" ? null : Math.floor(100 * j.fraction);
/** Progress label shown by the UI. */
export const learnLabel = (j: LearnJob) => j.stage === "queued" ? "排队等待学习"
  : learnPct(j) == null ? "正在学习…" : `正在学习… ${learnPct(j)}%`;

/** The music's shape for the lane's light ribbon (src-tauri/src/viz.rs), one frame every 1/60 s: `f` on the lane's
 *  clock (frames of 10 ms, as the notes), loudness and four bands 0..1, `beat` (jumps on a beat, decays) and
 *  `onset` (how sharply the bass rose on a beat's first frame, in dB; else 0). */
export type VizFrame = { f: number; rms: number; b: [number, number, number, number]; beat: number; onset: number };

export type SongState = {
  version: number; track: Track; lyrics: [number, string][]; heard: number; cached: boolean;
  cache: (number | null)[] | null; cacheBars: Bar[]; mode: "learn" | "sing"; learned: number;
  /** the syllable sung on each bar, when the song has syllable bars */
  barText: string[];
  /** first play: how fast the singer gets through the words (s per syllable), from the line-ups of the words heard */
  pace?: number | null;
  /** the song's beat (learned songs): song frames of each beat, which beat starts the bars, energy per beat */
  beats: { at: number[]; downbeat: number; bpm: number; energy: number[] } | null;
  /** first-play takes of this song already in the list when it started: one more means this play has ended
   *  (learnState.firstPlayGoing) */
  learnTakes?: number;
};

/** The events that belong to the song playing (engine.rs keep_for_catch_up), not all of which say its version. */
const SONG_EVENTS = new Set(["song", "update", "lyrics", "notes", "art", "track", "phase"]);

class Live {
  song: SongState | null = null;
  usr: (number | null)[] = [];
  /** the ribbon's frames, the last ~6 s */
  viz: VizFrame[] = [];
  songOffset: number | null = null;
  /** how loud you are (dB over the room's background) in the latest update; null when you're not heard */
  level: number | null = null;
  levelAt = 0;      // as shown: glides to the engine's value (offTarget) on small corrections
  private offTarget: number | null = null;
  private offPerf = 0;
  blind = false;
  aligned = false;
  lag = 25;
  score: number | null = null;
  takes: Take[] = [];
  /** songs being learned now, and how far each has got */
  learning: LearnJob[] = [];
  status: Status = { player: null };
  connected = false;
  ended = false;
  problem: string | null = null;
  /** listening mode's status line (finding the song, a new song, learning it…); null: nothing to say */
  line: Line | null = null;
  /** how sure the place in the song is (see placeReady); when the song began showing, and when it settled */
  place: "exact" | "confirmed" | "guess" | "provisional" = "exact";
  /** the music hasn't confirmed the place yet (the first guess is shown): since when, and when that ended */
  locking = false; lockFrom = 0; lockEnd = -1e9;
  /** over speakers, the song has been drowning the singer out (the engine's `drowned`: the singing check kept
   *  rejecting nearly all the voice the mic heard of the singer's part): the Sing page suggests turning it down */
  drowned = false;
  /** a YouTube video OnKey stopped learning because it sounded like talk, not a song (until dismissed) */
  notSong: { track_id: string; name: string } | null = null;
  private songPerf = 0;
  private readyPerf: number | null = null;
  private clockOffset: number | null = null;
  /** the live mirror (mirror()): how late events arrive in this tab after the engine sent them, ms */
  mirrorLag = { last: NaN, avg: NaN, max: 0, n: 0 };
  private listeners = new Set<() => void>();
  private snapshot = this.makeSnapshot();
  /** "Show lyrics" (Settings, on by default). Off: the song's lyric lines and the bars' words are hidden (kept
   *  here as they came, so turning it back on shows them again at once); the notes and the score are as ever. */
  lyricsOn = true;
  private rawLyrics: [number, string][] = [];
  private rawBarText: string[] = [];
  private shownLyrics() { return this.lyricsOn ? this.rawLyrics : []; }
  private shownBarText() { return this.lyricsOn ? this.rawBarText : []; }
  /** Show or hide the lyrics now (Settings' switch, and at start). */
  showLyrics(on: boolean) {
    if (on === this.lyricsOn) return;
    this.lyricsOn = on;
    if (this.song) this.song = { ...this.song, lyrics: this.shownLyrics(), barText: this.shownBarText() };
    this.changed();
  }

  // ---------------------------------------------------------------- events
  apply(ev: any, perf: number) {
    this.take(ev, perf);
    this.recheck();
  }
  private take(ev: any, perf: number) {
    switch (ev.type) {
      case "song":
        this.rawLyrics = ev.lyrics || []; this.rawBarText = ev.bar_text || [];
        this.song = { version: ev.version, track: ev.track, lyrics: this.shownLyrics(), heard: ev.heard, cached: ev.cached,
                      cache: ev.cached ? ev.cache : null, cacheBars: ev.cache_bars || [], barText: this.shownBarText(), beats: ev.beats || null, mode: ev.mode || "sing",
                      learned: ev.learned || 0, learnTakes: learnTakes(this.takes, ev.track) };
        this.usr = []; this.viz = []; this.drowned = false;
        if (this.ended) { this.ended = false; this.frozenPerf = null; }      // a new play after one you finished
        this.songOffset = this.offTarget = ev.song_offset; this.score = null; this.clockOffset = null; this.lastTap = null; this.stalledSince = null; this.blind = !!ev.blind; this.aligned = false;
        this.place = "provisional"; this.songPerf = perf; this.readyPerf = null; this.locking = false; this.lockEnd = -1e9;
        this.changed();
        break;
      case "art":                                     // the cover, found after the song started
        if (this.song && ev.version === this.song.version) { this.song = { ...this.song, track: { ...this.song.track, art: ev.art, link: ev.link } }; this.changed(); }
        break;
      case "track":                                   // you renamed the YouTube video playing
        if (this.song && ev.version === this.song.version) { this.song = { ...this.song, track: { ...this.song.track, name: ev.name, artist: ev.artist } }; this.changed(); }
        break;
      case "update": {
        if (!this.song || ev.version !== this.song.version) return;
        updateArrived(ev.at_ms);        // the records: how late updates reach the window (lib/perf.ts)
        // paused: the song's clock stops (no new audio), so the display must stop too rather than run on and
        // snap back; it carries on from exactly there when the audio moves again
        if (this.lastTap != null && ev.tap_now <= this.lastTap) {
          if (this.stalledSince == null) { this.stalledSince = perf; setTimeout(this.recheck, 160); }
        } else {
          if (this.stalledSince != null && perf - this.stalledSince > 150) this.clockOffset = null;
          this.stalledSince = null; this.lastTap = ev.tap_now;
        }
        const est = ev.tap_now - perf / 10;           // frames, as a low-passed clock for smooth scrolling
        if (this.stalledSince == null) {
          if (this.clockOffset == null || Math.abs(est - this.clockOffset) > 30) this.clockOffset = est;
          else this.clockOffset += (est - this.clockOffset) * 0.08;
        }
        const changed = ev.score !== this.score || ev.song_offset !== this.offTarget || !!ev.blind !== this.blind || !!ev.aligned !== this.aligned || (ev.place ?? "exact") !== this.place;
        // the engine refines where we are in the song (the music app's guess, then the music itself): a small
        // correction glides over about half a second instead of jerking the notes and lyrics sideways
        this.offTarget = ev.song_offset;
        if (this.offTarget == null || this.songOffset == null || Math.abs(this.offTarget - this.songOffset) > 4) this.songOffset = this.offTarget;
        this.lag = ev.lag;
        this.level = ev.level ?? null; this.levelAt = perf; this.score = ev.score;
        if (ev.heard != null && ev.heard !== this.song.heard) this.song = { ...this.song, heard: ev.heard };
        this.blind = !!ev.blind; this.aligned = !!ev.aligned; this.place = ev.place ?? "exact";
        if (!!ev.locking !== this.locking) {
          this.locking = !!ev.locking;
          if (this.locking) this.lockFrom = perf; else this.lockEnd = perf;
        }
        if (ev.usr) {
          put(this.usr, ev.usr[0], ev.usr[1]);
          this.countSinging(ev.usr[1], perf);
        }
        const drowned = !!ev.drowned && !this.drowned;
        if (drowned) this.drowned = true;
        if (changed || drowned) this.changed();
        break;
      }
      case "viz": {           // the music's shape, about every 100 ms (drawn by the lane when no notes are shown)
        if (!this.song || ev.version !== this.song.version) return;
        const step = 100 / (ev.fps || 60);
        (ev.fr as number[][]).forEach((r, i) => this.viz.push({ f: ev.f0 + i * step, rms: r[0], b: [r[1], r[2], r[3], r[4]], beat: r[5], onset: r[6] }));
        const keep = this.viz.length ? this.viz[this.viz.length - 1].f - 600 : 0;
        let k = 0;
        while (k < this.viz.length && this.viz[k].f < keep) k++;
        if (k) this.viz.splice(0, k);
        break;
      }
      case "lyrics":
        if (this.song && ev.version === this.song.version) {
          this.rawLyrics = ev.lyrics || [];
          this.song = { ...this.song, lyrics: this.shownLyrics(), pace: ev.pace ?? this.song.pace }; this.changed();
        }
        break;
      case "notes":           // the notes, now only where the lyrics are (the take carries on)
        if (this.song && ev.version === this.song.version) {
          this.rawBarText = ev.bar_text || [];
          this.song = { ...this.song, cache: ev.cache ?? this.song.cache, cacheBars: ev.cache_bars || [], barText: this.shownBarText() }; this.changed();
        }
        break;
      case "problem": this.problem = ev.kind; this.changed(); break;
      case "not_a_song": this.notSong = { track_id: ev.track_id, name: ev.name }; this.changed(); break;
      case "listen":                                  // the status line: what listening is doing now
        if (ev.line?.text !== this.line?.text) { this.line = ev.line ?? null; this.changed(); }
        break;
      case "takes": this.takes = ev.takes; this.changed(); break;
      case "learn_progress": this.learning = ev.songs ?? []; this.changed(); break;
      case "status": {
        // sent every few seconds, mostly the same: the window only re-renders when something in it changed
        const said = JSON.stringify(ev);
        if (said === this.lastStatus) break;
        this.lastStatus = said;
        this.lowPower = !!ev.low_power;
        this.draw30 = !!ev.draw_30;
        this.status = { player: ev.player, output_ms: ev.output_ms, output: ev.output, echo_cancel: ev.echo_cancel, youtube_blocked: ev.youtube_blocked ?? null, browser_sounding: ev.browser_sounding ?? null, youtube: !!ev.youtube, listening: !!ev.listening,
                                     mic: ev.mic, audio: ev.audio, automation_denied: ev.automation_denied ?? null, not_answering: ev.not_answering ?? null, models: ev.models,
                                     mic_device: ev.mic_device, music_quiet: ev.music_quiet ?? null };
        this.line = ev.listening ? ev.line ?? null : null;
        this.changed(); break;
      }
      case "phase":
        if (ev.phase === "ended") { this.ended = true; this.frozenPerf ??= perf; this.changed(); }   // stop the clock
        break;
    }
  }

  // ---------------------------------------------------------------- timing (frames, singer timeline)
  private lastTap: number | null = null;
  private stalledSince: number | null = null;
  now(perf: number) {
    if (this.offTarget != null && this.songOffset != null && this.songOffset !== this.offTarget) {
      const k = 1 - Math.exp(-Math.max(0, Math.min(100, perf - this.offPerf)) / 150);
      this.songOffset += (this.offTarget - this.songOffset) * k;
      if (Math.abs(this.offTarget - this.songOffset) < 0.002) this.songOffset = this.offTarget;
    }
    this.offPerf = perf;
    if (this.clockOffset == null || !this.song) return 0;
    // stalled (paused) for more than a moment: hold at the last audio received
    if (this.stalledSince != null && perf - this.stalledSince > 150 && this.lastTap != null)
      return Math.min(this.clockOffset + perf / 10, this.lastTap) - this.song.heard;
    return this.clockOffset + perf / 10 - this.song.heard;
  }
  songTime(perf: number) { return this.now(perf) / 100 + (this.songOffset || 0); }
  singerAt(f: number) {
    if (!this.song?.cache || this.songOffset == null) return NaN;
    const v = this.song.cache[Math.round(f + this.songOffset * 100)];
    return v == null ? NaN : v;
  }
  youAt(f: number) {
    const v = this.usr[Math.round(f + (this.song?.heard ?? 20))];
    return v == null || v < 28 || v > 96 ? NaN : v;
  }
  /** The syllable for bar i (same order as bars()), or "". */
  barText(i: number) { return this.song?.barText?.[i] ?? ""; }
  bars(): Bar[] {
    if (!this.song?.cache || this.songOffset == null) return [];
    const k = this.songOffset * 100;
    return this.song.cacheBars.map(([s, e, m]) => [s - k, e - k, m]);
  }
  /** In a quiet stretch (intro, instrumental break) of a learned song: seconds until the singing resumes and
   *  the song time to jump to (2 s before it), or null when singing is near. */
  lull(perf: number): { wait: number; to: number } | null {
    // learned songs only: on a first play the lyrics' timing isn't confirmed, and skipping would leave that
    // part of the song unlearned
    if (!this.song?.cache || this.songOffset == null || !this.aligned) return null;
    const now = this.now(perf), t = this.songTime(perf);
    const bars = this.bars();
    if (bars.some(([s, e]) => s <= now && now < e)) return null;
    const ahead = bars.filter(([s]) => s > now).map(([s]) => s);
    if (!ahead.length) return null;
    const next = t + (Math.min(...ahead) - now) / 100;
    // land 4 s before the singing: time for the position to settle (the app's jump is never exact) and to
    // get ready; only worth it if it saves at least 3 s
    if (next - t < 7) return null;
    return { wait: next - t, to: next - 4 };
  }

  /** Notes are shown once the song is learned and placed exactly in the music, unless you're singing blind. */
  showNotes() { return !!this.song?.cache && this.songOffset != null && this.aligned && !this.blind && this.placeReady(this.frozenPerf ?? performance.now()); }

  /** The place in the song is settled enough to show lyrics and notes: the music app said it (exact), or the
   *  music confirmed it; else after 4 s, the best guess (its small corrections glide). Until then the lane
   *  moves on and "Finding your place…" shows, so nothing appears in one place and then jumps. */
  placeReady(perf: number) {
    const ready = this.place !== "provisional" || perf - this.songPerf > 4000;
    if (ready && this.readyPerf == null) this.readyPerf = perf;
    return ready;
  }
  /** Seconds you've been heard singing this sitting (a break of REST_RESETS_MS or more starts a new one), for the
   *  reminder to rest your voice (components/VoiceBreak.tsx). */
  sungS = 0; lastSungPerf = -1e12;
  countSinging(vals: (number | null)[], perf: number) {
    const voiced = vals.filter(v => v != null).length;
    if (!voiced) return;
    if (perf - this.lastSungPerf > REST_RESETS_MS) this.sungS = 0;
    this.sungS += voiced * 0.01;
    this.lastSungPerf = perf;
  }
  /** How much to dim the notes while the music hasn't confirmed the place (0 to 1): fully until it's confirmed,
   *  at most LOCK_DIM_MAX_MS (a long dim in a quiet intro would put a singer off more than a slightly-off start),
   *  then back to sharp over 300 ms. */
  lockDim(perf: number) {
    const end = this.locking ? this.lockFrom + LOCK_DIM_MAX_MS : Math.min(this.lockEnd, this.lockFrom + LOCK_DIM_MAX_MS);
    if (this.locking && perf < end) return 1;
    return Math.max(0, 1 - (perf - end) / 300);
  }
  /** 0 to 1 over the 400 ms after the place settled: lyrics and notes fade in. */
  placeFade(perf: number) { return this.readyPerf == null ? 0 : Math.min(1, (perf - this.readyPerf) / 400); }

  // ---------------------------------------------------------------- React bridge
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.snapshot;
  private makeSnapshot() {
    return { song: this.song, takes: this.takes, learning: this.learning, status: this.status, score: this.score, connected: this.connected,
             ended: this.ended, lag: this.lag, blind: this.blind, aligned: this.aligned, problem: this.problem, line: this.line,
             drowned: this.drowned, notSong: this.notSong };
  }
  dismissNotSong() { if (this.notSong) { this.notSong = null; this.changed(); } }
  changed() { this.snapshot = this.makeSnapshot(); this.listeners.forEach(f => f()); }

  // ---------------------------------------------------------------- moving or still
  private lastStatus = "";
  /** macOS Low Power Mode is on (from the engine's status): the lane draws at most 30 times a second, no glow */
  lowPower = false;
  /** the lane draws at most 30 times a second (Low Power Mode, or on battery: Settings) */
  draw30 = false;
  private moving = false;
  private movers = new Set<() => void>();
  /** Something on screen moves with the song's clock: a song playing (not paused, finished or a replay's still)
   *  in a window that can be seen. The lane draws and the clock-driven parts re-render only then; otherwise
   *  OnKey's window costs nothing (no timers, no frames for macOS to composite). */
  playing() { return this.moving; }
  onPlaying = (fn: () => void) => { this.movers.add(fn); return () => { this.movers.delete(fn); }; };
  recheck = () => {
    // paused: the shown clock still runs on up to the last audio received (see now()), and is still from there
    const perf = performance.now();
    let stalled = this.stalledSince != null && perf - this.stalledSince > 150;
    if (stalled && this.clockOffset != null && this.lastTap != null && this.clockOffset + perf / 10 < this.lastTap) {
      stalled = false;
      setTimeout(this.recheck, 100);
    }
    const m = !!this.song && !this.ended && this.frozenPerf == null && this.clockOffset != null && !stalled
      && typeof document !== "undefined" && document.visibilityState === "visible";
    if (m !== this.moving) {
      this.moving = m; this.movers.forEach(f => f());
      // the engine holds learning back while you sing a learned song and watch it (src-tauri/src/learn.rs)
      if (inApp()) void invoke("ui_moving", { moving: m }).catch(() => {});
    }
  };

  // ---------------------------------------------------------------- connection
  private started = false;
  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    const params = new URLSearchParams(location.search);
    const replay = params.get("replay");
    if (replay) return this.replay(replay, parseFloat(params.get("t") || "0"), params.get("play"));
    // "Show lyrics" as set (Settings changes it from then on: showLyrics)
    void getSettings().then(s => { if (s) this.showLyrics(s.show_lyrics !== false); }).catch(() => {});
    if (inApp()) {
      // inside the OnKey app: the Rust engine sends events directly
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen("onkey", e => this.apply(e.payload, performance.now())).then(() =>
          // what happened before the window was listening (a take that started as OnKey launched): the song playing
          // and the latest of everything else, unless a newer song has already arrived
          invoke("catch_up").then(r => { const evs = (r ?? []) as any[];
            const now = performance.now();
            // (a song skipped as older takes its own events with it: "phase" says no version, and its "ended"
            // would stop the newer song's clock)
            let older = false;
            for (const ev of evs) {
              if (ev.type === "song") older = !!this.song && ev.version <= this.song.version;
              if (older && SONG_EVENTS.has(ev.type)) continue;
              this.apply(ev, now);
              // the takes came with it, maybe including this play's own: any first-play take of it counts as
              // ended (firstPlayGoing), else a song already learned would keep saying "Learning"
              if (ev.type === "song" && this.song) { this.song = { ...this.song, learnTakes: 0 }; this.changed(); }
            }
          }).catch(() => {}));
        // development builds' live mirror checks its timing against the window's (src-tauri/src/mirror.rs)
        listen<{ seq: number }>("onkey-probe", e => void invoke("ui_log", { msg: `probe ${e.payload.seq} app ${this.probe()}` }));
        this.connected = true; this.changed();
      });
      return;
    }
    const isMirror = mirror();
    const connect = () => {
      const es = new EventSource("/events");
      es.onopen = () => { this.connected = true; this.changed(); };
      es.onmessage = m => {
        const now = performance.now();
        // the mirror stamps each live event with when the engine sent it (epoch ms; 0 while catching up): the
        // clock runs from that moment, as the window's does from its (almost immediate) arrival, so a busy tab
        // getting events late doesn't make the lyrics and lane run late
        const sent = isMirror ? parseFloat(m.lastEventId) : 0;
        const perf = sent > 0 ? Math.min(now, sent - performance.timeOrigin) : now;
        this.apply(JSON.parse(m.data), perf);
        if (sent > 0) {
          const lag = now - perf, l = this.mirrorLag;
          l.last = lag; l.n++; l.max = Math.max(l.max, lag);
          l.avg = l.n === 1 ? lag : l.avg + (lag - l.avg) * 0.05;
        }
      };
      if (isMirror) {
        // caught up on the song so far: the clock is set afresh by the next live update (not the replayed ones)
        es.addEventListener("mirror", () => { this.clockOffset = null; this.lastTap = null; this.stalledSince = null; this.changed(); });
        es.addEventListener("probe", m => {
          const { seq } = JSON.parse((m as MessageEvent).data);
          void fetch(`/api/probe/report?seq=${seq}&${this.probe()}`);
        });
      }
      es.onerror = () => { this.connected = false; this.changed(); es.close(); setTimeout(connect, 1500); };
    };
    connect();
  }

  /** The lyric line showing at song time t (the Lyrics component uses this: LINE_LEAD s early), or -1. */
  lyricIndex(t: number) {
    let i = -1;
    for (const [k, [at]] of (this.song?.lyrics ?? []).entries()) if (at <= t + LINE_LEAD) i = k;
    return i;
  }

  /** For the mirror's timing check: the song time shown now, the moment (epoch ms) and the lyric line. */
  private probe() {
    const perf = performance.now(), t = this.songTime(perf);
    return `t=${t.toFixed(4)}&at=${(performance.timeOrigin + perf).toFixed(2)}&lyric=${this.lyricIndex(t)}`;
  }

  frozenPerf: number | null = null;     // replay: the moment to draw
  private async replay(url: string, t: number, play: string | null) {
    // test mode: rebuild the state from a recorded run and freeze at song time t (t < 0: the end). With
    // play=1 it then carries on in real time from there, as the engine sent it (the idle benchmark's playing
    // state); with play=pause the song stays paused there, its last update repeated as the engine does
    const lines = (await (await fetch(url)).text()).trim().split("\n");
    let perf = 0, i = 0, last: any = null;
    for (; i < lines.length; i++) {
      const ev = JSON.parse(lines[i]);
      if (ev.type === "update") {
        perf += 40;
        this.apply(ev, perf);
        last = ev;
        if (t >= 0 && this.song && this.songTime(perf) >= t) { i++; break; }
      } else if (ev.type !== "phase" || t < 0) this.apply(ev, perf);
    }
    this.connected = true;
    if (!play) this.frozenPerf = perf;
    this.changed(); this.recheck();
    (window as any).__ready = true;
    if (play === "pause" && last) setInterval(() => this.apply(last, performance.now()), 53);
    else if (play) {
      let tap = last?.tap_now ?? 0, due = performance.now();
      const next = () => {
        for (; i < lines.length; i++) {
          const ev = JSON.parse(lines[i]);
          if (ev.type === "update") {
            due += Math.max(0, Math.min(200, (ev.tap_now - tap) * 10)) || 53;
            tap = ev.tap_now;
            const wait = due - performance.now();
            if (wait > 1) { setTimeout(() => { this.apply(ev, performance.now()); i++; next(); }, wait); return; }
          }
          this.apply(ev, performance.now());
        }
      };
      next();
    }
  }
}

function put(arr: (number | null)[], start: number, vals: (number | null)[]) {
  for (let i = 0; i < vals.length; i++) arr[start + i] = vals[i];
}

export const live = new Live();
if (typeof window !== "undefined") {
  (window as any).__live = live;
  document.addEventListener("visibilitychange", live.recheck);
}

export function useSession() {
  return useSyncExternalStore(live.subscribe, live.getSnapshot, live.getSnapshot);
}

/** The learn going on for this song (see learnOf), also while its first play is still playing; null when it can be
 *  sung. Follows the engine's events, so a button using it enables itself the moment learning finishes. */
export function useLearn(t: { id: string; name: string; artist: string } | null | undefined): LearnJob | null {
  useEffect(() => { live.start(); }, []);
  const { learning, takes, song } = useSession();
  return t ? learnNow(learning, takes, song, t) : null;
}

/** Whether a song is playing in a window that can be seen (see live.playing). */
export function usePlaying() {
  return useSyncExternalStore(live.onPlaying, () => live.playing(), () => false);
}

/** Running inside the OnKey desktop app (Tauri), rather than served by the Python engine. */
export const inApp = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** A tab showing the running app's window through the development build's live mirror (src-tauri/src/mirror.rs):
 *  the mirror marks its pages; ?mirror also says so. It only watches: everything that would change something,
 *  control a music app or write a file does nothing here. */
export const mirror = () => typeof window !== "undefined" && !inApp()
  && ("__ONKEY_MIRROR__" in window || new URLSearchParams(location.search).has("mirror"));

async function invoke(cmd: string, args?: Record<string, unknown>) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

/** Listening mode: OnKey may control an app only once you've allowed it. A control it may not do comes back as
 *  `needs` (which app, the setting that allows it, the song if one was asked for); the window then asks
 *  (components/ControlPrompt.tsx), offering to allow it and try again, or to open the song in its app. */
export type ControlNeeded = { key: string; app: string; track: string | null; retry: () => Promise<unknown>; home?: boolean };

/** Run a control; true if it was done, false if it needs your permission first (the prompt is shown). */
async function controlled(cmd: string, args: Record<string, unknown>, retry: () => Promise<unknown>, home = false): Promise<boolean> {
  const r = (await invoke(cmd, args)) as { ok?: boolean; needs?: Omit<ControlNeeded, "retry" | "home"> } | null;
  if (r?.needs) {
    window.dispatchEvent(new CustomEvent<ControlNeeded>("onkey-control-needed", { detail: { ...r.needs, retry, home } }));
    return false;
  }
  return true;
}

/** Let OnKey control an app from now on ("control_spotify", "control_music" or "youtube"). */
export async function allowControl(key: string) {
  if (inApp()) await invoke("allow_control", { key });
}

/** Open a song in its app with an ordinary link (no control): you press play there, OnKey hears it. The app is
 *  the one it was last played in (by its id there when known), else the one you usually sing from. */
export async function openInApp(trackId: string) {
  if (inApp()) await invoke("open_in_app", { id: trackId });
}

/** The app a song opens in ("Spotify", "Apple Music", "YouTube"), by the same rule as openInApp. */
export async function openApp(trackId: string): Promise<string | null> {
  return inApp() ? ((await invoke("open_app", { id: trackId })) as string) : null;
}

/** Saved settings: listening mode and the per-app control conveniences. */
/** `listen_only`: OnKey controls no app (Spotify, Apple Music and YouTube all off): it follows songs by their sound alone. */
export type Settings = { version?: string; listening: boolean; control_spotify: boolean; control_music: boolean; youtube: boolean; listen_only?: boolean; hide_starters?: boolean;
  /** the learning models stay loaded between songs (on by default with 32 GB or more; never on an 8 GB Mac) */
  keep_models?: boolean; small_mac?: boolean;
  /** on battery, the lane draws at most 30 times a second (on by default) */
  battery_30fps?: boolean;
  /** a reminder to rest your voice after a long stretch of singing (on by default) */
  voice_breaks?: boolean;
  /** Shazam names songs not learned here when no music app OnKey controls says what plays (on by default) */
  shazam?: boolean;
  /** lyrics from LRCLIB shown with the notes (on by default); off, LRCLIB isn't asked and none are shown */
  show_lyrics?: boolean };
export async function getSettings(): Promise<Settings | null> {
  if (mirror()) return (await fetch("/api/settings")).json();
  return inApp() ? ((await invoke("settings_now")) as Settings) : null;
}
export async function setSetting(key: "listening" | "control_spotify" | "control_music" | "hide_starters" | "keep_models" | "battery_30fps" | "voice_breaks" | "shazam" | "show_lyrics", on: boolean) {
  if (inApp()) await invoke("set_setting", { key, on });
  if (key === "show_lyrics") live.showLyrics(on);
}

/** A microphone (an input device): Core Audio's id for it and its name. */
export type Mic = { uid: string; name: string };
/** The microphones connected, the one OnKey listens to now (`chosen`, null: none), and the one picked in Settings
 *  (`preferred`, null: automatic, the Mac's own input as chosen in System Settings → Sound). */
export type Mics = { devices: Mic[]; chosen: Mic | null; preferred: string | null };
export async function getMics(): Promise<Mics | null> {
  return inApp() ? ((await invoke("mics")) as Mics) : null;
}
/** Listen to this microphone (its uid), or null for automatic. */
export async function setMic(uid: string | null) {
  if (inApp()) await invoke("set_mic", { uid });
}

/** The output device now (Core Audio's uid and name) and its delay: what Core Audio says (`reported_ms`), what
 *  OnKey allows for (`heard_ms`), and your tap-along check's correction on top (`correction_ms`, null: never
 *  checked; src-tauri/src/timing.rs). `suggest`: never checked, likely Bluetooth (over 100 ms), not dismissed. */
export type OutputTiming = { uid: string; name: string; reported_ms: number; heard_ms: number; correction_ms: number | null;
  measured_ms: number | null; checked_at: number | null; suggest: boolean; music_playing?: boolean };
export async function getOutputTiming(): Promise<OutputTiming | null> {
  return inApp() ? ((await invoke("output_timing")) as OutputTiming) : null;
}
/** A timing check's run, each part on its own clock (src-tauri/src/timing.rs Run): clicks on the AudioContext's (s),
 *  its output timestamps [contextTime s, performanceTime ms], currentTime samples [s, performance.now() ms], taps
 *  [event.timeStamp ms, performance.now() ms in the handler]. */
export type TimingRun = { clicks: number[]; stamps: [number, number][]; now: [number, number][]; taps: [number, number][]; kinds: string[];
  base_latency: number | null; output_latency: number | null; sample_rate: number };
/** A check's result: kept (ok), one more to confirm it (confirm; before_ms: the check before, which didn't agree), or what to say. */
export type TimingResult = { ok?: boolean; confirm?: boolean; before_ms?: number | null; error?: string; measured_ms?: number; reported_ms?: number;
  correction_ms?: number; spread_ms?: number };
/** A timing check of output `uid` done. */
export async function checkOutputTiming(uid: string, run: TimingRun): Promise<TimingResult> {
  return inApp() ? ((await invoke("output_timing_check", { uid, run })) as TimingResult) : { error: "此操作只能在随声练桌面应用中使用。" };
}
export async function resetOutputTiming(uid: string) {
  if (inApp()) await invoke("output_timing_reset", { uid });
}
export async function dismissTimingHint(uid: string) {
  if (inApp()) await invoke("output_timing_dismiss", { uid });
}

/** Jump ahead to just before the singing resumes, if we're in a quiet stretch; true if it did. */
export function skipToSinging(): boolean {
  const l = live.lull(live.frozenPerf ?? performance.now());
  if (!l) return false;
  const go = () => controlled("skip_to", { seconds: l.to }, go);
  if (inApp()) void go();
  return true;
}

/** How "Play with the song" works for a take's track. `play_id`: the id its app plays it by (a song kept by its
 *  ISRC is played by its Spotify or Apple Music id), null when none is known. */
export type AlongMode = { control: boolean; app: string; key: string | null; play_id?: string | null };
/** How "Play with the song" works for a track: `control` (OnKey starts it, one click) or join in (listening mode
 *  without control: you play it in `app`, OnKey hears where it is and plays your recording in step). */
export async function alongMode(track: string): Promise<AlongMode | null> {
  return inApp() ? ((await invoke("along_mode", { track })) as AlongMode) : null;
}
/** Listen back by joining in: no new take while the track plays; the recording follows it. */
export async function joinAlong(track: string) {
  if (inApp()) await invoke("join_along", { track });
}

/** Listen back with the song: play the track in its app from this position (s), without it becoming a take.
 *  False when OnKey may not control that app (listening mode): the prompt is shown instead. */
export async function playAlong(track: string, position: number): Promise<boolean> {
  if (!inApp()) return false;
  const go = (): Promise<boolean> => controlled("play_along", { track, position }, go);
  return go();
}
export async function stopPlayAlong() {
  if (inApp()) await invoke("stop_play_along");
}
/** Where the music app is right now. */
export async function playerNow(): Promise<{ track: string; playing: boolean; position: number } | null> {
  if (!inApp()) return null;
  return (await invoke("player_now")) as { track: string; playing: boolean; position: number } | null;
}

/** Score this play now (the lyrics are over), without waiting for the song to end. */
export async function finishTake() {
  if (inApp()) await invoke("finish_take");
}

/** A take is playing back in the window (or stopped): listening mode must never take that sound for music. */
export async function takePlaying(on: boolean) {
  if (inApp()) await invoke("take_playing", { on });
}

/** Experimental YouTube (in Chrome, Safari, Brave or Edge) on/off. */
export async function setYouTube(on: boolean) {
  if (inApp()) await invoke("set_youtube", { on });
}

/** Echo cancelling on/off (off: to test with the song playing from speakers). */
export async function setEchoCancel(on: boolean) {
  if (inApp()) await invoke("set_echo_cancel", { on });
}

/** Play, pause, skip or start over, in the music app being followed. */
export async function control(action: "restart" | "next" | "previous" | "playpause") {
  if (inApp()) {
    const go = (): Promise<boolean> => controlled("player_control", { action }, go);
    await go();     // (awaited: the Library shows "Starting…" until the app has been asked)
    return;
  }
  if (mirror()) return;
  await fetch(`/api/spotify/${action}`, { method: "POST" });
}

/** Start a song in its app; with `home`, go to the Sing page once it's started. */
/** A song OnKey was just asked to play (its name, and when), so the Sing page says "Starting …" until it plays
 *  instead of showing what it shows when nothing is playing. */
let starting: { id: string; name: string; at: number } | null = null;
export function startingSong(): { id: string; name: string } | null {
  return starting && performance.now() - starting.at < STARTING_MS ? starting : null;
}
const STARTING_MS = 10000;

/** To the Sing page, in place (components/GoHome.tsx); a full load only if that isn't listening. */
export function goHome() {
  if ((window as unknown as { __onkeyGoHome?: boolean }).__onkeyGoHome) window.dispatchEvent(new CustomEvent("onkey-go-home"));
  else location.href = "/";
}

export async function playTrack(trackId: string, home = false, name = "") {
  if (inApp()) {
    const go = async (): Promise<boolean> => {
      const ok = await controlled("play_track", { id: trackId }, go, home);
      if (ok && home) {
        starting = { id: trackId, name, at: performance.now() };
        goHome();
      }
      return ok;
    };
    await go();     // (awaited: the Library shows "Starting…" until the app has been asked)
    return;
  }
  if (mirror()) return;
  await fetch(`/api/spotify/play?track=${encodeURIComponent(trackId)}`, { method: "POST" });
  if (home) {
    starting = { id: trackId, name, at: performance.now() };
    goHome();
  }
}

/** Your own artist and title for a YouTube video whose names were read wrong (used for its lyrics too). */
export async function renameTrack(trackId: string, artist: string, name: string) {
  if (inApp()) await invoke("rename_track", { id: trackId, artist, name });
}

export type TakeSummary = {
  id: string; track: Track; recorded: string; score: number; accuracy: number; coverage: number; within50: number;
  bias_cents: number; latency_ms: number; live_score: number | null; repeat: boolean; notes_hit: number | null; notes_total: number | null;
  mode?: "learn" | "sing"; blind?: boolean;
};

export async function setBlind(on: boolean) {
  if (mirror()) return;
  live.blind = on; live.changed();
  if (inApp()) return void invoke("set_blind", { on });
  await fetch(`/api/blind?on=${on ? 1 : 0}`, { method: "POST" });
}

export type LibrarySong = { track: Track; learned: string | null; fraction: number; ready: boolean; best: number | null;
                            /** how hard it is to sing, 1 (easy) to 5 (very hard), from its learned notes; null when too few */
                            difficulty?: number | null;
                            /** takes sung of it (with some singing heard) */
                            takes?: number;
                            /** hearted, and when (local time, 2026-10-13T09:15:00) */
                            favorite?: boolean; favorited_at?: string | null;
                            /** the app it opens in ("Spotify", "Apple Music", "YouTube"): see openInApp */
                            app?: string };

/** Heart a song or take its heart away. The name and artist find the learned song when it's kept under another id;
 *  a song still being learned gets its heart once it's saved. */
export async function setFavorite(track: Pick<Track, "id" | "name" | "artist">, on: boolean) {
  const args = { id: track.id, favorite: on, name: track.name, artist: track.artist };
  if (inApp()) await invoke("set_favorite", args);
  else if (!mirror()) await fetch(`/api/favorite?${new URLSearchParams({ ...args, favorite: on ? "1" : "0" })}`, { method: "POST" }).catch(() => {});
}

export async function isFavorite(track: Pick<Track, "id" | "name" | "artist">): Promise<boolean> {
  const args = { id: track.id, name: track.name, artist: track.artist };
  if (inApp()) return (await invoke("is_favorite", args)) as boolean;
  const r = await fetch(`/api/favorite?${new URLSearchParams(args)}`).catch(() => null);
  return r?.ok ? !!(await r.json()) : false;
}

/** Now, as the store writes times (local, 2026-10-13T09:15:00), for ordering favourites hearted on this page. */
export function nowLocal(): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ---------------------------------------------------------------- saved takes and learned songs
// From the Rust engine inside the app; from the Python engine's server otherwise.
export async function getTakes(): Promise<TakeSummary[]> {
  if (inApp()) return (await invoke("takes")) as TakeSummary[];
  return (await fetch("/api/takes")).json();
}

export async function getLibrary(): Promise<LibrarySong[]> {
  if (inApp()) return (await invoke("library")) as LibrarySong[];
  return (await fetch("/api/library")).json();
}

export async function getTake(id: string): Promise<any | null> {
  if (inApp()) return invoke("take", { id });
  const r = await fetch(`/api/take?id=${encodeURIComponent(id)}`);
  return r.ok ? r.json() : null;
}

/** "Report a problem" (components/ReportProblem.tsx): what the zip of OnKey's records will hold. */
export type ReportContents = { folder: string; bytes: number; files: { name: string; bytes: number; what: string }[] };

export async function prepareReport(take: string | null): Promise<ReportContents> {
  if (!inApp()) throw new Error("问题报告只能在随声练桌面应用中生成。");
  return (await invoke("report_prepare", { take })) as ReportContents;
}

/** Save the report (macOS's save panel): where it went, or null if cancelled. */
export async function saveReport(description: string): Promise<string | null> {
  return (await invoke("report_save", { description })) as string | null;
}

export async function openReportFolder() { if (inApp()) await invoke("report_open_folder"); }
export async function showInFinder(path: string) { if (inApp()) await invoke("report_show", { path }); }
export async function openReportIssue(take: string | null) { if (inApp()) await invoke("report_issue", { take }); }

/** A URL the <audio> element can play your recording of a take from. */
export async function takeAudioUrl(id: string): Promise<string> {
  if (inApp()) {
    const path = (await invoke("take_audio", { id })) as string | null;
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    return path ? convertFileSrc(path) : "";
  }
  return `/api/audio?id=${encodeURIComponent(id)}`;
}

/** The macOS privacy pane where OnKey is allowed to hear other apps' audio. */
export async function openPrivacySettings() {
  if (inApp()) return void invoke("open_privacy_settings");
}

/** Mini mode: the window shrinks to a small lyrics bar floating above other apps. */
export async function setMini(on: boolean) {
  if (inApp()) await invoke("set_mini", { on });
}

/** Delete a take (it goes to the Trash). */
export async function deleteTake(id: string) {
  if (inApp()) await invoke("delete_take", { id });
}

/** Forget a learned song; it will be learned again the next time it plays. Your takes stay. */
export async function forgetSong(id: string) {
  if (inApp()) await invoke("forget_song", { id });
}

/** Stop learning a song and delete it (a learning card's delete: a video that isn't a song, say). A YouTube video
 *  isn't learned again; anything else isn't while it keeps playing. */
export async function stopLearning(t: { id: string; name: string; artist: string }) {
  if (inApp()) await invoke("stop_learning", { id: t.id, name: t.name, artist: t.artist });
}

/** A video OnKey took for talk is a song after all: it's learned the next time it plays. */
export async function learnAnyway(id: string) {
  if (inApp()) await invoke("learn_anyway", { id });
  live.dismissNotSong();
}

// ---------------------------------------------------------------- first-run setup

/** A permission's state: "ask" (not asked yet), "granted", "denied", "restricted" (blocked by a profile),
 *  "unknown" (macOS won't say without asking). */
export type Perm = "ask" | "granted" | "denied" | "restricted" | "unknown";
/** An app's Automation permission (may OnKey control it): "not_running" means macOS asks once OnKey first
 *  talks to it. */
export type AppPerm = "ask" | "granted" | "denied" | "restricted" | "not_running" | "not_installed" | "unknown";
export type SetupStatus = { mic: Perm; audio: Perm; macos_ok: boolean; done: boolean;
                            control?: { spotify: AppPerm; music: AppPerm }; listen_only?: boolean;
                            asked?: { spotify?: AskAnswer; music?: AskAnswer } };
/** What asking macOS for control of an app answered (setup's Allow): as AppPerm, or "waiting" (no answer yet: its
 *  question may still be showing) or "not_asked" (Listen only was chosen meanwhile). */
export type AskAnswer = AppPerm | "waiting" | "not_asked";

/** In the browser (development) setup runs on made-up answers: ?mock=ask|denied|granted. */
const mockPerm = (): Perm => {
  const m = typeof location !== "undefined" ? new URLSearchParams(location.search).get("mock") : null;
  return m === "granted" || m === "denied" ? m : "ask";
};

export async function setupStatus(): Promise<SetupStatus> {
  if (inApp()) return (await invoke("setup_status")) as SetupStatus;
  const p = mockPerm();
  return { mic: p, audio: p, macos_ok: true, done: false,
           control: { spotify: p as AppPerm, music: p === "granted" ? "granted" : "not_running" }, listen_only: false };
}

/** Let OnKey follow and control Spotify and Apple Music (macOS asks for each running one), or listen only. */
export async function setupControl(allow: boolean): Promise<SetupStatus | null> {
  if (inApp()) return (await invoke("setup_control", { allow })) as SetupStatus;
  return null;
}

/** Ask macOS for the microphone or system audio recording. For "audio", true if it's allowed now. */
export async function setupRequest(what: "mic" | "audio"): Promise<boolean> {
  if (inApp()) return (await invoke("setup_request", { what })) as boolean;
  return false;
}

/** Open the System Settings pane for the microphone or system audio recording. */
export async function setupOpenSettings(what: "mic" | "audio" | "automation") {
  if (inApp()) await invoke("setup_open_settings", { what });
}

/** Start or stop listening to the mic for the setup level meter; true if it's running. */
export async function setupMeter(on: boolean): Promise<boolean> {
  if (inApp()) return (await invoke("setup_meter", { on })) as boolean;
  return on;
}

/** The mic's latest level in dBFS. */
export async function setupLevel(): Promise<number> {
  if (inApp()) return (await invoke("setup_level")) as number;
  const t = performance.now() / 1000;                     // made up: a voice coming and going
  return Math.sin(t * 1.3) > 0 ? -28 + 8 * Math.sin(t * 9) : -70;
}

/** Mark setup done (it won't open by itself again), or not done (it opens next time). */
export async function setupDone(done: boolean) {
  if (inApp()) await invoke("setup_done", { done });
}

/** The open-source licences and notices shipped inside the app (THIRD_PARTY_NOTICES.md); null outside the app. */
export async function thirdPartyNotices(): Promise<string | null> {
  return inApp() ? ((await invoke("third_party_notices")) as string) : null;
}

/** Open a song's Apple Music page, or a Spotify search or playlist (only those links open). */
export async function openLink(url: string) {
  if (inApp()) await invoke("open_link", { url });
  else window.open(url, "_blank", "noopener");
}

// ---------------------------------------------------------------- sharing a take

/** A share clip's place in the song (whole seconds): from the playhead `t` (s into the take), or the take's best
 *  bit when `t` is left out. Null: none (no best bit: nothing hit). */
export type ShareWindow = { start: number; end: number; at: string; to: string; graph: number; hits: number; notes: number };
export async function shareWindow(id: string, t?: number): Promise<ShareWindow | null> {
  if (!inApp()) return null;
  return (await invoke("share_window", { id, t: t ?? null })) as ShareWindow | null;
}
/** Makes the share video into Downloads (shown in Finder; the song's start time copied). Its path. */
export async function shareTake(id: string, start: number): Promise<{ path: string; at: string }> {
  return (await invoke("share_take", { id, start })) as { path: string; at: string };
}
