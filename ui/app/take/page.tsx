"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo, Nav } from "@/components/Nav";
import LearnBar from "@/components/LearnBar";
import { reportProblem } from "@/components/ReportProblem";
import SharePanel from "@/components/SharePanel";
import { DevCopy, takeLink } from "@/components/Dev";
import { allowControl, alongMode, type AlongMode, getSettings, getTake, joinAlong, learnLabel, playAlong, playTrack, playerNow, stopPlayAlong, takeAudioUrl, takePlaying, type Track, useLearn, useSession } from "@/lib/session";
import { COLORS, clock, credit, grade, noteName, scoreWord, sourceName, when } from "@/lib/music";

type Line = { t0: number; t1: number; text: string; ref_frames: number; coverage: number; accuracy: number | null; bias: number | null };
type Result = {
  track: Track; recorded: string; score: number; accuracy: number; coverage: number; within50: number; bias_cents: number;
  latency_ms: number; frame_s: number; song_offset?: number | null; lines: Line[]; ref: (number | null)[]; usr: (number | null)[]; err: (number | null)[];
  notes?: [number, number, number, number][]; notes_hit?: number; notes_total?: number; live?: { score: number | null; cached: boolean } | null;
  mode?: "learn" | "sing"; blind?: boolean;
  /** false: an older take whose recording isn't kept (every take's is, until they pass 2 GB together) */
  audio_kept?: boolean;
};

export default function TakePage() {
  return <Suspense><Take /></Suspense>;
}

/** How much to raise a recording so its singing plays at a listening level: the loud tenth of its 100 ms stretches
 *  (the singing, not the gaps) brought to -16 dBFS, by 0 to 30 dB. */
async function singingGain(b: Blob): Promise<number> {
  try {
    const ctx = new OfflineAudioContext(1, 1, 16000);
    const buf = await ctx.decodeAudioData(await b.arrayBuffer());
    const x = buf.getChannelData(0), n = Math.floor(buf.sampleRate / 10);
    const db: number[] = [];
    for (let i = 0; i + n <= x.length; i += n) {
      let e = 0;
      for (let k = i; k < i + n; k++) e += x[k] * x[k];
      db.push(10 * Math.log10(e / n + 1e-12));
    }
    if (!db.length) return 1;
    db.sort((p, q) => p - q);
    const loud = db[Math.floor(0.9 * (db.length - 1))];
    return Math.pow(10, Math.max(0, Math.min(30, -16 - loud)) / 20);
  } catch { return 1; }
}

// into the app's log (Tauri's ui_log), for diagnosing playback
function logUi(msg: string) {
  try { (window as any).__TAURI_INTERNALS__?.invoke("ui_log", { msg }); } catch {}
}

function Take() {
  const id = useSearchParams().get("id") ?? "";
  const [r, setR] = useState<Result | null | undefined>(undefined);
  const [lyricsOff, setLyricsOff] = useState(false);
  // "Show lyrics" off (Settings): the lines are scored as ever, but their words aren't shown
  useEffect(() => {
    Promise.all([getTake(id), getSettings().catch(() => null)])
      .then(([take, s]) => {
        const off = s?.show_lyrics === false;
        setLyricsOff(off);
        setR(take && off ? { ...take, lines: take.lines.map((l: Line) => ({ ...l, text: "" })) } : take);
      })
      .catch(() => setR(null));
  }, [id]);
  const job = useLearn(r?.track);     // the song still being learned: it can be sung again once that's done
  const [src, setSrc] = useState("");
  // the recording, loaded into memory once (a few MB), so jumping around in it is instant
  useEffect(() => {
    // (left before the fetch ends: its blob URL is never made, so none is left behind)
    let url = "", alive = true;
    // (an AAC recording typed audio/mp4 whatever the asset protocol guessed; an older take's WAV as served)
    takeAudioUrl(id).then(async u => {
      if (!u) return null;            // no recording kept: nothing to fetch
      const b = await (await fetch(u)).blob();
      return /\.m4a($|\?)/i.test(u) ? new Blob([b], { type: "audio/mp4" }) : b;
    })
      .then(b => {
        if (!alive) return;
        if (!b) { setSrc(""); return; }
        blob.current = b; url = URL.createObjectURL(b); setSrc(url);
        void singingGain(b).then(g => { boost.current.gain = g; if (boost.current.node) boost.current.node.gain.value = g; });
      })
      .catch(() => takeAudioUrl(id).then(u => { if (alive) setSrc(u); }).catch(() => { if (alive) setSrc(""); }));
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  const audio = useRef<HTMLAudioElement>(null);
  const blob = useRef<Blob | null>(null);
  // your recording is the raw microphone, quiet next to the music (singing ~-30 to -45 dBFS, Spotify near full
  // level: live, "Play with the song" let only the loudest notes through): it plays brought up to a listening level,
  // through a limiter (see singingGain), set up on the first play (sound may only start from a click)
  const boost = useRef<{ gain: number; node: GainNode | null; ctx: AudioContext | null }>({ gain: 1, node: null, ctx: null });
  // closed when the page goes: WebKit allows only a few AudioContexts, and after several take pages a new one
  // would fail (the voice boost silently gone)
  useEffect(() => () => {
    const b = boost.current;
    if (b.ctx) void b.ctx.close().catch(() => {});
    b.ctx = null; b.node = null;
  }, []);
  // called from every click that starts sound (WebKit only lets an AudioContext start from one): set up once, then
  // make sure it's running, or the recording plays into a suspended context and is silent
  const route = () => {
    const a = audio.current;
    if (!a) return;
    if (boost.current.ctx) {
      if (boost.current.ctx.state !== "running") void boost.current.ctx.resume().then(() => logUi(`take playback: sound ${boost.current.ctx?.state}`));
      return;
    }
    try {
      const ctx = new AudioContext();
      const node = ctx.createGain();
      node.gain.value = boost.current.gain;
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.1;
      ctx.createMediaElementSource(a).connect(node).connect(limit).connect(ctx.destination);
      boost.current.node = node; boost.current.ctx = ctx;
      void ctx.resume().then(() => logUi(`take playback: voice raised ${(20 * Math.log10(boost.current.gain)).toFixed(1)} dB, sound ${ctx.state}`));
    } catch (e) { logUi(`take playback: no level boost (${e})`); }
  };
  const [t, setT] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [playing, setPlaying] = useState(false);
  // "Play with the song" plays the recording decoded into Web Audio, not through the <audio> element: the element
  // lands seeks on an AAC recording ~0.7 s from where it's told, so the sync loop kept re-seeking it every second or
  // two and nudging its speed in between (stutters, the voice changing speed and pitch). A buffer starts at an exact
  // sample and runs on the audio clock, so it only needs moving when the song jumps.
  const voice = useRef<{ buf: AudioBuffer | null; src: AudioBufferSourceNode | null; at: number; from: number }>({ buf: null, src: null, at: 0, from: 0 });
  const voicePos = () => {
    const v = voice.current, c = boost.current.ctx;
    return v.src && c ? v.from + (c.currentTime - v.at) : (audio.current?.currentTime ?? 0);
  };
  // the playhead shows the moment you're hearing, on the graph's time line. Two delays put it behind the
  // recording's own clock:
  //  - the take's `latency_ms`: scoring moved your voice that much earlier to meet the singer's notes (how late the
  //    song reached you while singing, the mic's delay, how late you sang), and the graph draws it moved, so the
  //    voice playing at recording time τ is drawn at τ - latency
  //  - the output's delay now (Bluetooth headphones ~150-250 ms, Core Audio's figure, as live scoring allows for)
  // The sound needs nothing: in "Play with the song" your voice and the song share the output and reach you together.
  // Everything shown (the playhead, playing or paused, the line lit, where a click goes) is on that heard time line.
  const { status } = useSession();
  const heardMs = useRef(0), latency = useRef(0);
  latency.current = (r?.latency_ms ?? 0) / 1000;
  heardMs.current = (status.output_ms ?? 0) + (r?.latency_ms ?? 0);
  // where playback last started on the graph: until the first sound reaches you (the output's delay) the playhead
  // waits there, so a click puts it exactly where clicked and resuming doesn't jump back
  const heardFrom = useRef(0);
  const heardPos = () => Math.max(0, heardFrom.current, voicePos() - heardMs.current / 1000);
  const voiceStop = () => {
    const v = voice.current;
    if (v.src) { const s = v.src; v.src = null; try { s.stop(); } catch {} s.disconnect(); }
  };
  const voiceStart = (pos: number) => {
    const v = voice.current, c = boost.current.ctx, n = boost.current.node;
    if (!v.buf || !c || !n) return;
    voiceStop();
    const s = c.createBufferSource();
    s.buffer = v.buf; s.connect(n); s.start(0, Math.max(0, pos));
    v.src = s; v.at = c.currentTime; v.from = Math.max(0, pos);
    heardFrom.current = Math.max(0, pos - latency.current);
    s.onended = () => { if (voice.current.src === s) { voice.current.src = null; setPlaying(false); } };
    setPlaying(true);
  };
  // listening back with the song: the music app plays the track, your recording follows its position (lined up
  // the way the take was scored), corrected several times a second
  const [along, setAlong] = useState(false);
  // the share panel's "Play it": when its 20 s are up
  const clipStop = useRef<number | undefined>(undefined);
  // listening mode without control of the song's app: you play the song there and OnKey joins in (`joined`: it
  // has heard the song and the recording is following it)
  const [mode, setMode] = useState<AlongMode | null>(null);
  const [joined, setJoined] = useState(false);
  const [joinFrom, setJoinFrom] = useState(0);
  useEffect(() => { if (r) alongMode(r.track.id).then(setMode).catch(() => setMode(null)); }, [r]);
  const holdUntil = useRef(0);        // after asking the app to jump, or a seek: readings settle for a moment
  // the last few (song position - recording position) differences: the music app's position arrives late by a
  // varying 50-300 ms (it's asked over Apple Events), so one reading isn't a drift; the median of five is
  const off = (r?.song_offset ?? 0) - (r?.latency_ms ?? 0) / 1000;      // song time at the recording's start
  const songAt = (g: number) => Math.max(0, (r?.song_offset ?? 0) + g);  // song time at graph time g
  useEffect(() => {
    if (!along || !r) return;
    let alive = true;
    // each change in what the sync loop decides goes to the app's log, to diagnose listening back
    let said = "";
    const diffs: number[] = [];
    const say = (what: string) => { if (what !== said) { said = what; logUi(`play with the song: ${what}`); } };
    const tick = async () => {
      const n = await playerNow().catch(() => null);
      if (!alive) return;
      const v = voice.current;
      if (!v.buf) { say("decoding the recording"); return; }
      if (performance.now() < holdUntil.current) return;
      const quiet = (why: string) => { say(why); if (v.src) { voiceStop(); setPlaying(false); } setJoined(false); };
      if (!n) return quiet("no music app state");
      // (the player names the song by the id it's kept under, or, outside listening mode, by its app's own id)
      if (n.track !== r.track.id && n.track !== mode?.play_id) return quiet(`the music app plays another track (${n.track}, take ${r.track.id})`);
      if (!n.playing) return quiet("the music is paused");
      setJoined(true);
      const target = n.position - off;
      if (target < 0 || target > v.buf.duration) return quiet(`outside the recording (song ${n.position.toFixed(1)} s, recording ${target.toFixed(1)} of ${v.buf.duration.toFixed(1)} s)`);
      say("playing together");
      if (!v.src) { diffs.length = 0; voiceStart(target); holdUntil.current = performance.now() + 400; return; }
      setT(heardPos());
      diffs.push(target - voicePos());
      if (diffs.length > 5) diffs.shift();
      if (diffs.length < 3) return;
      const diff = [...diffs].sort((x, y) => x - y)[Math.floor(diffs.length / 2)];
      // only a real jump in the song moves the recording; the audio clock doesn't drift within a song
      if (Math.abs(diff) > 0.3) {
        say(`moved the recording ${diff.toFixed(2)} s`);
        voiceStart(target); diffs.length = 0; holdUntil.current = performance.now() + 400;
      }
    };
    const id = setInterval(tick, 150);
    return () => { alive = false; clearInterval(id); voiceStop(); setPlaying(false); };
  }, [along, r, off, mode]);
  useEffect(() => () => { void stopPlayAlong(); }, []);
  // your recording playing here is never to be heard as music by listening mode
  useEffect(() => { void takePlaying(playing); }, [playing]);
  useEffect(() => () => { void takePlaying(false); }, []);
  const startAlong = (from: number) => {
    route();      // from the click: the window only lets sound start from one
    audio.current?.pause(); voiceStop();
    const c = boost.current.ctx;
    if (!voice.current.buf && c && blob.current)
      blob.current.arrayBuffer().then(x => c.decodeAudioData(x))
        .then(buf => { voice.current.buf = buf; logUi(`play with the song: recording decoded (${buf.duration.toFixed(1)} s)`); })
        .catch(e => logUi(`play with the song: couldn't decode the recording (${e})`));
    setAlong(true); holdUntil.current = performance.now() + 700;
    if (mode && !mode.control) {
      // join in: it plays once the song is heard
      setJoinFrom(songAt(from)); setJoined(false);
      void joinAlong(r!.track.id);
      return;
    }
    void playAlong(mode?.play_id ?? r!.track.id, songAt(from)); };
  const stopAlong = () => { setAlong(false); voiceStop(); setPlaying(false); audio.current?.pause(); void stopPlayAlong(); };

  if (r === undefined) return <Shell><div className="glass mt-8 h-64 rounded-3xl shimmer" /></Shell>;
  if (r === null) return <Shell><p className="mt-10 text-ink-300">找不到这条练习记录。</p></Shell>;
  const bias = Math.round(r.bias_cents);
  // s on the graph: you want to hear s, so the recording goes to s + latency (the graph draws your voice moved
  // that much earlier); the output's delay is taken care of by the playhead waiting at s (heardFrom)
  const seek = (s: number) => {
    if (!audio.current) return;
    s = Math.max(0, s);
    heardFrom.current = s; setT(s);
    if (along) { startAlong(s); return; }
    // moved there; it plays on only if it was playing (press Play to start from here)
    audio.current.currentTime = s + latency.current;
    if (playing) { route(); void audio.current.play(); }
  };

  // an ended recording starts again from 0, so the playhead waits there, not at the end
  const play = () => {
    const a = audio.current;
    if (!a) return;
    const from = a.ended ? 0 : t;
    heardFrom.current = from; setT(from);
    route(); void a.play();
  };

  return (
    <Shell>
      <audio ref={audio} src={src || undefined} preload="auto"
             onTimeUpdate={() => setT(heardPos())} onPlay={() => { route(); setPlaying(true); }}
             onPause={() => { setT(heardPos()); setPlaying(false); }} onEnded={() => setPlaying(false)} />
      <section className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
        <ScoreRing score={r.score} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-ink-400">
            {when(r.recorded)}
            <ModeBadge blind={r.mode === "learn" || !!r.blind} first={r.mode === "learn"} />
          </div>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{r.track.name}</h1>
          <div className="text-lg text-ink-300">{r.track.artist}</div>
          <p className="mt-3 max-w-2xl text-ink-200">{verdict(r)}</p>
          {job && <LearnBar job={job} className="mt-3 max-w-sm" />}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={() => playTrack(r.track.id, true, r.track.name)} disabled={!!job} title={job ? "学习完成后即可再次演唱" : undefined}
                    className="tabular rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-accent-600/25 transition hover:bg-accent-400
                               disabled:cursor-default disabled:bg-white/6 disabled:text-ink-300 disabled:shadow-none">
              {job ? learnLabel(job) : "再唱一次"}
            </button>
            {r.audio_kept !== false && (
            <button onClick={() => { if (along) stopAlong(); else if (playing) audio.current?.pause(); else { play(); } }}
                    className="rounded-xl bg-white/6 px-4 py-2 text-sm font-medium text-ink-100 transition hover:bg-white/10">
              {playing && !along ? "暂停" : "播放演唱录音"}
            </button>
            )}
            {r.song_offset != null && r.audio_kept !== false && (
              <button onClick={() => (along ? stopAlong() : startAlong(t))}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${along ? "bg-accent-500/20 text-accent-200 hover:bg-accent-500/30" : "bg-white/6 text-ink-100 hover:bg-white/10"}`}>
                {along ? "停止" : "跟歌曲一起播放"}
              </button>
            )}
            {/* back to the beginning, whichever way it's playing (or about to: from where it stopped) */}
            {r.audio_kept !== false && t > 1 && (
              <button onClick={() => { seek(0); if (audio.current && !along) { route(); void audio.current.play(); } }} title="从头播放"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/6 px-3 py-2 text-sm font-medium text-ink-100 transition hover:bg-white/10">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
                </svg>
                从头开始
              </button>
            )}
            {r.song_offset != null && r.audio_kept !== false && (
              <button onClick={() => setSharing(v => !v)} aria-expanded={sharing}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/6 px-3 py-2 text-sm font-medium text-ink-100 transition hover:bg-white/10">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                </svg>
                分享片段
              </button>
            )}
          </div>
          {sharing && r.song_offset != null && (
            <SharePanel id={id} song={r.track.name} t={t} onClose={() => setSharing(false)}
                        onShow={g => { if (!playing && !along) { heardFrom.current = g; setT(g); } }}
                        onPlay={g => {
                          if (along) stopAlong();
                          seek(g);
                          if (audio.current) { route(); void audio.current.play(); }
                          // just the clip: it stops after its 20 s
                          window.clearTimeout(clipStop.current);
                          clipStop.current = window.setTimeout(() => audio.current?.pause(), 20_000);
                        }} />
          )}
          {along && mode && !mode.control && !joined ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-accent-500/10 px-3 py-2 text-sm text-accent-100">
              <span>请在 {mode.app} 中播放《{r.track.name}》{joinFrom < 5 ? "，从头开始播放" : ""}；随声练会自动跟上。</span>
              {joinFrom >= 5 && <span className="text-accent-200/80">请在 {mode.app} 中跳到 {clock(joinFrom)}，播放这一段。</span>}
              {mode.key && (
                <button onClick={async () => { await allowControl(mode.key!); const m = await alongMode(r.track.id); setMode(m); stopAlong(); }}
                        className="text-xs text-accent-300 underline-offset-2 hover:underline">允许随声练为你启动歌曲</button>
              )}
            </div>
          ) : r.audio_kept === false ? (
            <p className="mt-2 text-xs text-ink-400">这条记录的录音已不再保留：随声练会保留所有练习录音，直到总量超过 2 GB，之后删除最早的录音（不会删除已收藏歌曲的录音或该歌曲最高分记录）。评分仍会保留。</p>
          ) : (
            <p className="mt-2 text-xs text-ink-400">随声练保存你的演唱录音，不保存音乐。“跟歌曲一起播放”{mode && !mode.control ? `会在你通过 ${mode.app} 播放《${r.track.name}》时同步播放录音` : `会同时播放你在 ${sourceName(r.track.id)} 中的歌曲和演唱录音`}。</p>
          )}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="音准" value={`${Math.round(100 * r.accuracy)}%`} sub={`${Math.round(100 * r.within50)}% 在 50 音分以内`} />
        <Tile label="命中音符" value={r.notes_total ? `${r.notes_hit}/${r.notes_total}` : "–"} sub="保持在目标音符半音范围内" />
        <Tile label="跟唱覆盖率" value={`${Math.round(100 * r.coverage)}%`} sub="主唱部分" />
        <Tile label="音准倾向" value={Math.abs(bias) < 10 ? "居中" : `${Math.abs(bias)} 音分${bias > 0 ? "偏高" : "偏低"}`}
              sub={Math.abs(bias) < 10 ? "没有明显偏高或偏低" : bias > 0 ? "平均音高略高" : "平均音高略低"} />
        <Tile label="延迟补偿" value={`${r.latency_ms} 毫秒`} sub="已自动补偿" />
      </section>

      <section className="glass mt-4 rounded-3xl p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-medium text-ink-200">你与原唱的音高对比</h2>
          <div className="flex flex-wrap gap-4 text-xs text-ink-300">
            <Key color="#6252e0" label="原唱音符" bar /><Key color={COLORS.good} label="你，偏差在 50 音分内" />
            <Key color={COLORS.close} label="偏差在 100 音分内" /><Key color={COLORS.off} label="偏差更大" />
          </div>
        </div>
        <PitchView r={r} t={t} playing={playing} onSeek={seek} clock={heardPos} />
      </section>
      <div className="mt-3 flex items-center justify-end gap-4">
        <DevCopy label="复制练习记录链接" text={() => takeLink("take", id, { t, song: r.song_offset != null ? r.song_offset + t : null })} />
        <button onClick={() => reportProblem(id)} className="text-xs text-ink-400 underline-offset-2 transition hover:text-white hover:underline">
          报告这次练习的问题
        </button>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-ink-200">逐句明细</h2>
        {r.lines.length === 0 ? <p className="text-ink-400">{lyricsOff ? "歌词已关闭（可在“设置”中开启），因此这条记录没有逐句报告。" : "没有找到这首歌的同步歌词。"}</p> : (
          <div className="glass divide-y divide-white/5 overflow-hidden rounded-3xl">
            {r.lines.map((l, i) => <LineRow key={i} n={i + 1} l={l} active={t >= l.t0 && t < l.t1} onClick={() => seek(l.t0)} />)}
          </div>
        )}
      </section>
    </Shell>
  );
}

function ModeBadge({ blind, first }: { blind: boolean; first?: boolean }) {
  return blind
    ? <span className="rounded-full bg-white/6 px-2 py-0.5 text-xs font-medium text-ink-200" title="演唱时未显示音符">盲唱{first ? " · 首次" : ""}</span>
    : <span className="rounded-full bg-accent-500/12 px-2 py-0.5 text-xs font-medium text-accent-300" title="演唱时提前显示了音符">引导演唱</span>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      <header data-tauri-drag-region className="app-header flex items-center gap-5 px-6 pt-4 pb-3"><Logo /><Nav /></header>
      <main className="mx-auto max-w-6xl px-6 pb-16">
        <Link href="/history" className="text-sm text-ink-400 transition hover:text-white">← 所有练习记录</Link>
        {children}
      </main>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const R = 54, C = 2 * Math.PI * R;
  return (
    <div className="relative grid h-[148px] w-[148px] place-items-center">
      <svg width={148} height={148} className="-rotate-90">
        <circle cx={74} cy={74} r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={10} />
        <circle cx={74} cy={74} r={R} fill="none" stroke="url(#ring)" strokeWidth={10} strokeLinecap="round"
                strokeDasharray={`${(C * score) / 100} ${C}`} />
        <defs><linearGradient id="ring" x1="0" x2="1"><stop offset="0" stopColor="#b5a8ff" /><stop offset="1" stopColor="#6252e0" /></linearGradient></defs>
      </svg>
      <div className="absolute text-center">
        <div className="tabular text-5xl font-bold tracking-tight">{score}</div>
        <div className="text-xs font-medium text-accent-300">{scoreWord(score)}</div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="glass rounded-2xl px-4 py-3.5">
      <div className="text-xs text-ink-400">{label}</div>
      <div className="tabular mt-1 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-ink-400">{sub}</div>
    </div>
  );
}

function Key({ color, label, bar }: { color: string; label: string; bar?: boolean }) {
  return <span className="flex items-center gap-1.5"><span className={bar ? "h-2 w-4 rounded-full" : "h-2 w-2 rounded-full"} style={{ background: color }} />{label}</span>;
}

function LineRow({ l, n, active, onClick }: { l: Line; n: number; active: boolean; onClick: () => void }) {
  const scored = l.accuracy != null && l.ref_frames > 20 && l.coverage > 0.2;
  const b = l.bias == null ? 0 : Math.round(l.bias);
  const note = l.ref_frames <= 20 ? "没有主唱" : l.coverage <= 0.2 ? "未演唱" : Math.abs(b) >= 25 ? `${Math.abs(b)} 音分偏${b > 0 ? "高" : "低"}` : "";
  const col = !scored ? "" : l.accuracy! >= 0.85 ? COLORS.good : l.accuracy! >= 0.65 ? COLORS.close : COLORS.off;
  return (
    <button onClick={onClick} aria-label={`播放 ${clock(l.t0)} 处：${l.text || `第 ${n} 句`}`} className={`grid w-full grid-cols-[52px_1fr_minmax(80px,180px)_96px] items-center gap-4 px-5 py-3 text-left transition hover:bg-white/3 ${active ? "bg-accent-500/8" : ""}`}>
      <span className="tabular text-sm text-ink-400">{clock(l.t0)}</span>
      <span className={`truncate ${active ? "text-white" : "text-ink-100"}`}>{l.text || <span className="text-ink-400">第 {n} 句</span>}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-white/6">
        {scored && <span className="block h-full rounded-full" style={{ width: `${100 * l.accuracy!}%`, background: col }} />}
      </span>
      <span className="text-right text-xs text-ink-300"><span className="tabular font-semibold text-ink-100">{scored ? `${Math.round(100 * l.accuracy!)}%` : ""}</span> {note}</span>
    </button>
  );
}

function verdict(r: Result) {
  const parts: string[] = [];
  if (r.coverage < 0.35) parts.push("这首歌有不少部分没有跟唱，因此可评分内容较少。");
  parts.push(r.accuracy > 0.85 ? "音准非常出色。" : r.accuracy > 0.7 ? "大部分音准稳定，少数部分有些偏差。" :
             r.accuracy > 0.5 ? "不少音符唱得接近，部分地方有些偏离。" : "有些地方没有跟上旋律。");
  if (Math.abs(r.bias_cents) >= 20) parts.push(`平均音高${r.bias_cents > 0 ? "偏高" : "偏低"} ${Math.abs(Math.round(r.bias_cents))} 音分。`);
  const worst = r.lines.filter(l => l.accuracy != null && l.coverage > 0.3 && l.ref_frames > 30).sort((a, b) => a.accuracy! - b.accuracy!)[0];
  if (worst && worst.accuracy! < 0.75) parts.push(worst.text ? `可以再练一次：“${worst.text}”。` : `可以再练一下 ${clock(worst.t0)} 处的这一句。`);
  return parts.join(" ");
}

// ------------------------------------------------------------------ the pitch view
function PitchView({ r, t, playing, onSeek, clock }: { r: Result; t: number; playing: boolean; onSeek: (s: number) => void;
                     clock: () => number }) {
  const cv = useRef<HTMLCanvasElement>(null), ov = useRef<HTMLCanvasElement>(null);
  const dt = r.frame_s, N = r.ref.length, dur = N * dt;
  const WIN = 12;
  // open where the singing starts (not on the intro)
  const [view0, setView0] = useState(() => {
    const first = r.usr.findIndex((u, i) => u != null && r.ref[i] != null);
    const sing = first >= 0 ? first : r.ref.findIndex(v => v != null);
    return Math.max(0, Math.min(dur - WIN, (Math.max(0, sing) * dt) - 1));
  });
  const range = useMemo(() => {
    const v = r.ref.filter((x): x is number => x != null).sort((a, b) => a - b);
    return v.length ? [Math.floor(v[Math.floor(v.length * 0.01)] - 3), Math.ceil(v[Math.floor(v.length * 0.99)] + 3)] : [48, 72];
  }, [r]);
  // follow playback (only while your take is playing, so browsing isn't yanked back)
  useEffect(() => {
    if (playing && (t > view0 + WIN * 0.8 || t < view0)) setView0(Math.max(0, Math.min(dur - WIN, t - WIN * 0.2)));
  }, [t, playing]); // eslint-disable-line

  useEffect(() => {
    const c = cv.current!, g = c.getContext("2d")!, dpr = devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const FONT = getComputedStyle(document.body).fontFamily;
    const [lo, hi] = range, L = 40, B = 22, plotH = H - B;
    const x = (s: number) => L + ((s - view0) / WIN) * (W - L);
    const y = (m: number) => plotH - ((m - lo) / (hi - lo)) * (plotH - 6);
    g.clearRect(0, 0, W, H);
    for (let m = Math.ceil(lo); m <= hi; m++) {
      if (m % 12 !== 0 && m % 12 !== 7) continue;
      g.fillStyle = "rgba(255,255,255,.05)"; g.fillRect(L, y(m), W - L, 1);
      g.fillStyle = "#5d6780"; g.font = `11px ${FONT}`; g.textBaseline = "middle"; g.fillText(noteName(m), 4, y(m));
    }
    const f0 = Math.max(0, Math.floor(view0 / dt)), f1 = Math.min(N, Math.ceil((view0 + WIN) / dt));
    // singer's notes as bars, lit by how much of each you held
    const rowH = (plotH - 6) / (hi - lo);
    for (const [a, b, m, held] of r.notes ?? []) {
      if (b < f0 || a > f1) continue;
      const x0 = x(a * dt), x1 = x(b * dt), h = Math.max(5, rowH * 0.7);
      g.fillStyle = "#2a2f6b"; roundRect(g, x0, y(m) - h / 2, x1 - x0, h, h / 2); g.fill();
      g.fillStyle = held >= 0.5 ? "rgba(52,210,123,.35)" : "rgba(124,108,246,.35)";
      roundRect(g, x0, y(m) - h / 2, (x1 - x0) * Math.min(1, held), h, h / 2); g.fill();
    }
    // singer's exact pitch, faint
    g.strokeStyle = "rgba(181,168,255,.45)"; g.lineWidth = 1.5; g.beginPath();
    let pen = false;
    for (let i = f0; i < f1; i++) {
      const m = r.ref[i];
      if (m == null || (pen && Math.abs(m - (r.ref[i - 1] ?? m)) > 1.5)) { pen = false; if (m == null) continue; }
      if (pen) g.lineTo(x(i * dt), y(m)); else g.moveTo(x(i * dt), y(m));
      pen = true;
    }
    g.stroke();
    // you, coloured by closeness
    g.lineWidth = 3; g.lineCap = "round";
    for (let i = f0 + 1; i < f1; i++) {
      const a = r.usr[i - 1], b = r.usr[i], e = r.err[i];
      if (a == null || b == null || Math.abs(a - b) > 1.5) continue;
      g.strokeStyle = COLORS[grade(e == null ? NaN : e)];
      g.beginPath(); g.moveTo(x((i - 1) * dt), y(a)); g.lineTo(x(i * dt), y(b)); g.stroke();
    }
    // lyrics under the plot
    g.fillStyle = "#8b94ab"; g.font = `12px ${FONT}`; g.textBaseline = "alphabetic";
    for (const l of r.lines) {
      if (l.t1 < view0 || l.t0 > view0 + WIN) continue;
      const xs = Math.max(L, x(l.t0));
      g.save(); g.beginPath(); g.rect(xs, plotH, Math.max(0, x(l.t1) - xs - 8), B); g.clip();
      g.fillText(l.text, xs + 2, H - 6); g.restore();
    }
  }, [r, view0, range, dt, N]);

  // playhead on its own layer: while playing, redrawn every frame from the heard time (only this small canvas,
  // never the page: React re-rendering at 60 fps made playback stutter); otherwise at `t` (heard time too)
  useEffect(() => {
    const c = ov.current!, g = c.getContext("2d")!, dpr = devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const draw = (at: number) => {
      g.clearRect(0, 0, W, H);
      const px = 40 + ((at - view0) / WIN) * (W - 40);
      if (px >= 40 && px <= W) { g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(px - 1, 0, 2, H - 22); }
    };
    draw(t);
    if (!playing) return;
    let raf = 0;
    const step = () => { draw(clock()); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [t, view0, playing]); // eslint-disable-line

  // drag to scroll, click to seek
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);
  return (
    <div>
      <div className="relative h-[300px] cursor-grab select-none active:cursor-grabbing"
           onPointerDown={e => { drag.current = { x: e.clientX, v: view0, moved: false }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
           onPointerMove={e => {
             if (!drag.current) return;
             const dx = e.clientX - drag.current.x;
             if (Math.abs(dx) > 3) drag.current.moved = true;
             const w = (e.currentTarget as HTMLElement).clientWidth - 40;
             setView0(Math.max(0, Math.min(dur - WIN, drag.current.v - (dx / w) * WIN)));
           }}
           onPointerUp={e => {
             if (drag.current && !drag.current.moved) {
               const r0 = (e.currentTarget as HTMLElement).getBoundingClientRect();
               onSeek(view0 + ((e.clientX - r0.left - 40) / (r0.width - 40)) * WIN);
             }
             drag.current = null;
           }}>
        <canvas ref={cv} role="img" aria-label="音高对比图：横轴为歌曲时间，纵轴为音高；可点击或拖动查看不同位置" className="absolute inset-0 h-full w-full" />
        <canvas ref={ov} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      {/* clicking the strip plays from there (and shows that part of the chart) */}
      <Overview r={r} view0={view0} win={WIN} onPick={s => { setView0(Math.max(0, Math.min(dur - WIN, s - WIN / 2))); onSeek(s); }} />
    </div>
  );
}

function Overview({ r, view0, win, onPick }: { r: Result; view0: number; win: number; onPick: (s: number) => void }) {
  const N = r.ref.length, dur = N * r.frame_s, bins = 160;
  const cells = useMemo(() => Array.from({ length: bins }, (_, b) => {
    let n = 0, s = 0, rv = 0;
    for (let i = Math.floor((b / bins) * N); i < Math.floor(((b + 1) / bins) * N); i++) {
      if (r.ref[i] != null) rv++;
      const e = r.err[i];
      if (e != null) { n++; s += credit(e); }
    }
    return n ? s / n : rv ? -1 : null;
  }), [r, N]);
  return (
    <div className="relative mt-3 h-8 cursor-pointer" onClick={e => { const rc = e.currentTarget.getBoundingClientRect(); onPick(((e.clientX - rc.left) / rc.width) * dur); }}>
      <div className="flex h-full items-center gap-px">
        {cells.map((c, i) => (
          <div key={i} className="flex-1 rounded-sm" style={{
            height: c == null ? 0 : c < 0 ? 6 : 26,
            background: c == null ? "transparent" : c < 0 ? "rgba(255,255,255,.08)" : c >= 0.85 ? COLORS.good : c >= 0.65 ? COLORS.close : COLORS.off,
            opacity: c != null && c >= 0 ? 0.85 : 1,
          }} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 rounded-md border border-accent-300/70" style={{ left: `${(view0 / dur) * 100}%`, width: `${(win / dur) * 100}%` }} />
    </div>
  );
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
