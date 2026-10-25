"use client";
// Settings → Your output: "Check timing on <device>", a tap-along check of how long after the music app plays you
// hear it on this output (src-tauri/src/timing.rs says why, and how it's allowed for). A steady click plays here,
// through the same output as the music; you tap with each click you hear. Nothing on screen moves with the
// clicks: you'd tap with what you see, which isn't late.
import { useCallback, useEffect, useRef, useState } from "react";
import { checkOutputTiming, getOutputTiming, resetOutputTiming, takePlaying, type OutputTiming, type TimingResult, type TimingRun } from "@/lib/session";

/** 24 clicks at 100 bpm (14.4 s); the engine doesn't count the first 4 (timing.rs SKIP): 20 taps tell tapping
 *  along from reacting to each click well enough (timing.rs reacting) */
const CLICKS = 24;
const BEAT_S = 60 / 100;

/** What a check found, in words. */
export function timingSaid(name: string, r: TimingResult) {
  if (r.confirm) return r.before_ms != null
    ? `本次测得 ${r.measured_ms} 毫秒，与上次的 ${r.before_ms} 毫秒不一致。请再测一次确认。`
    : `声音在播放 ${r.measured_ms} 毫秒后传到你耳中（macOS 报告为 ${r.reported_ms} 毫秒）。请再测一次确认。`;
  const c = r.correction_ms ?? 0;
  if (Math.abs(c) < 20) return `${name} 的延迟与随声练的预估一致，误差在 ${Math.abs(c)} 毫秒以内。`;
  return `${name} 比随声练预估的延迟${c > 0 ? "更长" : "更短"} ${Math.abs(c)} 毫秒，已据此校准。`;
}

/** How to tap: in rhythm, not reacting to each click (a reaction comes 150+ ms late and uneven). */
const HOW = "跟着节拍点击，就像随节奏拍手。不要等听到每一声点击后再反应，请保持节拍。";

type Progress = { taps: number; progress: number };

/** Not yet checked on real headphones: labelled experimental in Settings, and the Sing page doesn't suggest it. */
export const TIMING_CHECK_VERIFIED = false;

/** Context time leaving for the output, and when (performance.now ms): WebKit's getOutputTimestamp. */
type Stamped = AudioContext & { getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number }; outputLatency?: number; baseLatency?: number };

/** Plays the clicks and records the taps, each on its own clock (the engine puts them on one: timing.rs Run). A
 *  fresh context each run (its clock starts at 0 each time; the page's goes on). */
function runCheck(onTap: (n: number) => void, onProgress: (p: number) => void, signal: AbortSignal): Promise<TimingRun | null> {
  return new Promise(resolve => {
    const ctx = new AudioContext({ latencyHint: "interactive" }) as Stamped;
    const taps: [number, number][] = [], kinds: string[] = [];
    const stamps: [number, number][] = [], now: [number, number][] = [];
    let clicks: number[] = [];
    let tick = 0, raf = 0, from = 0, end = Infinity;
    const started = performance.now();
    // the context's clock against the page's, through the run: the output's own timestamps (which context time is
    // going out, and when on the page's clock) and currentTime with performance.now() (the fallback)
    const sample = () => {
      if (!clicks.length) return;
      const ts = ctx.getOutputTimestamp?.();
      if (ts && ts.contextTime && ts.performanceTime) stamps.push([ts.contextTime, ts.performanceTime]);
      now.push([ctx.currentTime, performance.now()]);
    };
    const loop = () => { sample(); raf = requestAnimationFrame(loop); };
    // the event's own time and when its handler ran, both on the page's clock (the engine picks)
    const tap = (at: number, kind: string) => {
      if (!clicks.length) return;
      taps.push([at, performance.now()]); kinds.push(kind); onTap(taps.length);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { finish(false); return; }
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      e.preventDefault(); e.stopPropagation();
      tap(e.timeStamp, "key");
    };
    const pointer = (e: PointerEvent) => { if ((e.target as HTMLElement | null)?.closest?.("[data-tap-pad]")) tap(e.timeStamp, "pointer"); };
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf); clearInterval(tick);
      window.removeEventListener("keydown", key, true); window.removeEventListener("pointerdown", pointer, true);
      const run: TimingRun = { clicks, stamps, now, taps, kinds, base_latency: ctx.baseLatency ?? null,
                               output_latency: ctx.outputLatency ?? null, sample_rate: ctx.sampleRate };
      void ctx.close();
      resolve(ok ? run : null);
    };
    signal.addEventListener("abort", () => finish(false));
    // the clicks once the output has been going for a second (Bluetooth headphones wake up first), well ahead
    const schedule = () => {
      const t0 = ctx.currentTime + 0.6;
      clicks = Array.from({ length: CLICKS }, (_, i) => t0 + i * BEAT_S);
      for (const [i, t] of clicks.entries()) {
        // a short woodblock-like tick, higher on each bar's first beat
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = i % 4 === 0 ? 1760 : 1320;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.45, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.08);
      }
      end = clicks[clicks.length - 1] + 0.9;
    };
    void ctx.resume().then(() => {
      if (done) return;
      // silence meanwhile keeps the output going
      const keep = ctx.createConstantSource(), quiet = ctx.createGain();
      quiet.gain.value = 0; keep.connect(quiet).connect(ctx.destination); keep.start();
      from = ctx.currentTime;
      window.addEventListener("keydown", key, true); window.addEventListener("pointerdown", pointer, true);
      raf = requestAnimationFrame(loop);
      tick = window.setInterval(() => {
        sample();
        if (!clicks.length && ctx.currentTime - from >= 1) schedule();
        onProgress(clicks.length ? Math.min(1, Math.max(0, (ctx.currentTime - clicks[0]) / (end - clicks[0]))) : 0);
        if (ctx.currentTime >= end) finish(true);
        if (!clicks.length && performance.now() - started > 8000) finish(false);   // the context never got going
      }, 25);
    }).catch(() => finish(false));
  });
}

export function TimingCheck() {
  const [o, setO] = useState<OutputTiming | null>(null);
  const [run, setRun] = useState<Progress | null>(null);
  const [result, setResult] = useState<{ uid: string; r: TimingResult } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const running = run != null;
  const load = useCallback(() => getOutputTiming().then(v => setO(v)).catch(() => {}), []);
  useEffect(() => {
    void load();
    // another output chosen (headphones connected) shows up; not while a check runs
    const t = window.setInterval(() => { if (document.visibilityState === "visible" && !abort.current) void load(); }, 3000);
    return () => { clearInterval(t); abort.current?.abort(); };
  }, [load]);
  if (!o || !o.uid) return null;

  const start = async () => {
    (document.activeElement as HTMLElement | null)?.blur();     // Space taps, not presses the button again
    const uid = o.uid;
    const a = new AbortController();
    abort.current = a;
    setResult(null); setRun({ taps: 0, progress: 0 });
    void takePlaying(true);                                     // listening mode doesn't take the clicks for music
    try {
      const got = await runCheck(n => setRun(r => r && { ...r, taps: n }), p => setRun(r => r && { ...r, progress: p }), a.signal);
      if (got) setResult({ uid, r: await checkOutputTiming(uid, got) });
    } catch {
      setResult({ uid, r: { error: "校准音无法播放，请检查音频输出设备后重试。" } });
    } finally {
      void takePlaying(false);
      abort.current = null; setRun(null);
      void load();
    }
  };
  const reset = async () => { await resetOutputTiming(o.uid); setResult(null); void load(); };
  const checked = o.correction_ms != null;
  const shown = result?.uid === o.uid ? result.r : null;
  const button = "shrink-0 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-sm text-ink-100 transition hover:bg-white/8 disabled:opacity-40";

  return (
    <>
      <h2 id="output-timing" className="mt-8 mb-2 px-1 text-sm font-medium text-ink-200">音频输出</h2>
      <section className="glass overflow-hidden rounded-3xl">
        <div className="flex items-start justify-between gap-6 px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink-100">
              {TIMING_CHECK_VERIFIED ? "" : <span className="mr-1.5 rounded bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-200">实验功能</span>}
              校准 {o.name || "此输出设备"}
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {checked
                ? <>已通过手动校准：随声练为此设备的声音传播预留了 {o.heard_ms} 毫秒（macOS 报告为 {o.reported_ms} 毫秒）。</>
                : <>根据 macOS 的报告，随声练为此设备的声音传播预留了 {o.reported_ms} 毫秒。蓝牙耳机的实际延迟通常更长，可能导致歌词和音符显示过早。跟着节拍点击即可测量延迟（需要测两次，且两次结果应一致）。</>}
              {!running && <span className="mt-1 block text-ink-300">{HOW}</span>}
              {o.music_playing && !running ? <span className="text-amber-200">请先暂停音乐。</span> : null}
            </p>
          </div>
          {!running && (
            <div className="flex shrink-0 gap-2">
              {checked && <button onClick={reset} className={button}>重置</button>}
              <button onClick={start} disabled={!!o.music_playing} className={checked ? button
                : "shrink-0 rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-400 disabled:opacity-40"}>
                {shown?.confirm ? "再次确认" : checked ? "重新校准" : "开始校准"}
              </button>
            </div>
          )}
        </div>
        {run && (
          <div data-tap-pad role="button" tabIndex={-1} aria-label="听到每次节拍时点击"
               className="mx-5 mb-4 select-none rounded-2xl border border-white/8 bg-white/4 px-5 py-6 text-center">
            <div className="text-sm font-medium text-ink-100">跟着节拍按空格键或点击此处</div>
            <p className="mt-1 text-xs text-ink-400">{run.progress < 0.35 ? HOW : "听节拍并保持到结束，不要一直盯着画面。按 Esc 停止。"}</p>
            <div className="tabular mt-3 text-2xl font-semibold text-ink-100">{run.taps}</div>
            <div className="mx-auto mt-3 h-1 max-w-xs overflow-hidden rounded-full bg-white/6">
              <div className="h-full bg-accent-400 transition-[width] duration-100 ease-linear" style={{ width: `${run.progress * 100}%` }} />
            </div>
            <button onClick={() => abort.current?.abort()} className="mt-4 text-xs text-ink-400 transition hover:text-ink-100">取消</button>
          </div>
        )}
        {shown && !running && (
          <div className={`flex items-start justify-between gap-6 border-t border-white/6 px-5 py-3 text-sm ${shown.error ? "text-amber-200" : "text-ink-100"}`}>
            <span role="status">{shown.error ?? timingSaid(o.name || "此输出设备", shown)}</span>
          </div>
        )}
      </section>
    </>
  );
}
