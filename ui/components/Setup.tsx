"use client";
// First-run setup: what OnKey does, the two permissions it needs (the microphone, and system audio recording to
// hear the music app), letting it follow Spotify and Apple Music (recommended; or listen only), a quick "say
// something" mic check, then off you go. Shown by itself until finished; reopened from the "Setup" link on the
// waiting screen.
import { useCallback, useEffect, useRef, useState } from "react";
import { getMics, setupControl, setupDone, setupLevel, setupMeter, setupOpenSettings, setupRequest, setupStatus, type AppPerm, type AskAnswer, type Perm, type SetupStatus } from "@/lib/session";

const STEPS = ["欢迎", "权限", "音乐应用", "麦克风测试", "完成"] as const;

export default function Setup({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [st, setSt] = useState<SetupStatus | null>(null);
  const [audioOk, setAudioOk] = useState(false);        // the tap was allowed when we asked (status may say "unknown")

  const refresh = useCallback(() => { setupStatus().then(setSt).catch(() => {}); }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);              // pick up changes made in System Settings
    addEventListener("focus", refresh);
    return () => { clearInterval(t); removeEventListener("focus", refresh); };
  }, [refresh]);

  const finish = async () => { await setupDone(true); onClose(); };
  const audio: Perm = audioOk && st?.audio !== "denied" ? "granted" : st?.audio ?? "unknown";
  const both = st?.mic === "granted" && audio === "granted";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/90 px-6">
      <div className="glass w-full max-w-lg animate-rise rounded-3xl px-8 pt-7 pb-6 shadow-2xl shadow-black/50" role="dialog" aria-label="设置随声练">
        <ol className="mb-6 flex items-center gap-2" aria-label="设置步骤">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-1.5">
              <span className={`h-1 rounded-full transition-colors ${i <= step ? "bg-accent-400" : "bg-white/8"}`} />
              <span className={`text-[11px] ${i === step ? "text-ink-200" : "text-ink-500"}`}>{s}</span>
            </li>
          ))}
        </ol>

        {step === 0 && <Welcome macosOk={st?.macos_ok ?? true} onNext={() => setStep(1)} onLater={onClose} />}
        {step === 1 && st && (
          <Permissions mic={st.mic} audio={audio} onAudioAllowed={() => setAudioOk(true)} refresh={refresh}
                       onNext={() => setStep(2)} canContinue={both} />
        )}
        {step === 1 && !st && <div className="h-40 rounded-2xl shimmer" />}
        {step === 2 && <MusicApps st={st} refresh={refresh} onNext={() => setStep(3)} />}
        {step === 3 && <MicCheck micOk={st?.mic === "granted"} onNext={() => setStep(4)} onBack={() => setStep(1)} />}
        {step === 4 && <Ready onFinish={finish} />}
      </div>
    </div>
  );
}

function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
            className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}

function Quiet({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="text-sm text-ink-400 transition hover:text-ink-100">{children}</button>;
}

function Welcome({ macosOk, onNext, onLater }: { macosOk: boolean; onNext: () => void; onLater: () => void }) {
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">欢迎使用随声练</h2>
      <p className="mt-2 text-ink-300">跟着你正在播放的歌曲练习演唱。</p>
      <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink-200">
        <Point icon="M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z">
          像平时一样在音乐应用中播放歌曲。随声练会聆听 Mac 正在播放的音乐并自动跟随。
        </Point>
        <Point icon="M3 14c2.5 0 2.5-6 5-6s2.5 8 5 8 2.5-10 5-10 2 4 3 4">
          每首歌首次播放时，随声练会学习演唱旋律。之后练习时，你可以提前看到音符，并查看自己的音高偏差。
        </Point>
        <Point icon="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z">
          随声练不会保存听到的音乐。你的演唱录音保存在这台 Mac 上，供你回听。听歌识曲时，应用会将音乐的短音频指纹（不是音频本身）发送给 Apple 的 Shazam，以识别新歌曲。
        </Point>
      </ul>
      {!macosOk && (
        <p className="mt-5 rounded-xl bg-close/10 px-4 py-3 text-sm text-close">
          随声练需要 macOS 14.2 或更高版本才能听到其他应用的声音。请前往“系统设置 → 通用 → 软件更新”升级 macOS。
        </p>
      )}
      <div className="mt-7 flex items-center justify-between">
        <Quiet onClick={onLater}>稍后设置</Quiet>
        <Primary onClick={onNext} disabled={!macosOk}>开始设置</Primary>
      </div>
    </>
  );
}

function Point({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-500/12 text-accent-300">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={icon} /></svg>
      </span>
      <span>{children}</span>
    </li>
  );
}

function Permissions({ mic, audio, onAudioAllowed, refresh, onNext, canContinue }: {
  mic: Perm; audio: Perm; onAudioAllowed: () => void; refresh: () => void; onNext: () => void; canContinue: boolean;
}) {
  const [asking, setAsking] = useState<"" | "mic" | "audio">("");
  const ask = async (what: "mic" | "audio") => {
    setAsking(what);
    try {
      const ok = await setupRequest(what);
      if (what === "audio" && ok) onAudioAllowed();
    } finally { setAsking(""); refresh(); }
  };
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">需要两项权限</h2>
      <p className="mt-2 text-sm text-ink-300">macOS 会分别询问一次。之后可在“系统设置 → 隐私与安全性”中更改。</p>
      <div className="mt-5 space-y-3">
        <PermRow title="麦克风" why="用于听到你的演唱。" state={mic} busy={asking === "mic"}
                 onAsk={() => ask("mic")} onSettings={() => setupOpenSettings("mic")}
                 settingsHint="在“麦克风”中允许随声练。" />
        <PermRow title="系统音频录制" why="用于听到 Mac 上播放的音乐，以学习歌曲旋律。随声练不会保存或发送音乐；识别新歌曲时，短音频指纹（不是音频本身）可能会发送给 Apple 的 Shazam。"
                 state={audio} busy={asking === "audio"} onAsk={() => ask("audio")} onSettings={() => setupOpenSettings("audio")}
                 settingsHint="打开“屏幕与系统音频录制”，并在“仅系统音频录制”下允许随声练。" />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        如果 macOS 在授权后要求退出并重新打开随声练，请按提示操作。设置会从上次中断的位置继续。
      </p>
      <div className="mt-6 flex items-center justify-between">
        <Quiet onClick={onNext}>{canContinue ? "" : "暂时跳过"}</Quiet>
        <Primary onClick={onNext} disabled={!canContinue}>继续</Primary>
      </div>
    </>
  );
}

function PermRow({ title, why, state, busy, onAsk, onSettings, settingsHint }: {
  title: string; why: string; state: Perm; busy: boolean; onAsk: () => void; onSettings: () => void; settingsHint: string;
}) {
  const granted = state === "granted";
  const blocked = state === "denied" || state === "restricted";
  return (
    <div className={`rounded-2xl border px-4 py-3.5 transition-colors ${granted ? "border-good/25 bg-good/5" : "border-white/8 bg-white/3"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${granted ? "bg-good/20 text-good" : blocked ? "bg-off/15 text-off" : "bg-white/8 text-ink-400"}`} aria-hidden>
          {granted ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          ) : blocked ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          ) : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-ink-100">{title}</span>
            {granted ? <span className="text-xs font-medium text-good">已允许</span>
              : blocked ? (
                <button onClick={onSettings} className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:bg-white/12">打开系统设置</button>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-ink-400">{state === "unknown" ? "状态未知" : "尚未请求"}</span>
                  <button onClick={onAsk} disabled={busy}
                          className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-400 disabled:opacity-50">
                    {busy ? "正在请求…" : "允许"}
                  </button>
                </span>
              )}
          </div>
          <p className="mt-1 text-sm text-ink-400">{why}</p>
          {blocked && <p className="mt-1.5 text-xs text-off/80">{state === "restricted" ? "这台 Mac 的设置禁止此操作，请联系设备管理员。" : settingsHint}</p>}
        </div>
      </div>
    </div>
  );
}

/** Let OnKey follow (and control) Spotify and Apple Music: exact, instant positions. Allow is the main action; it has
 *  macOS ask for each app that's running (the others ask the first time OnKey talks to them). "Listen only" turns
 *  control off: songs are followed by their sound. */
function MusicApps({ st, refresh, onNext }: { st: SetupStatus | null; refresh: () => void; onNext: () => void }) {
  const [chose, setChose] = useState<"" | "asking" | "allowed">("");
  const [asked, setAsked] = useState<SetupStatus["asked"]>(undefined);
  const [slow, setSlow] = useState(false);           // asking has taken a while: offer to carry on
  const allowRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; allowRef.current?.focus(); return () => { alive.current = false; }; }, []);
  const allow = async () => {
    setChose("asking");
    setSlow(false);
    // macOS's question waits for you (OnKey waits up to 40 s per app); after 6 s you may carry on, and after 90 s
    // setup stops waiting by itself: an app not answered for is asked the first time OnKey talks to it
    const slowTimer = setTimeout(() => { if (alive.current) setSlow(true); }, 6000);
    const gaveUp = new Promise<"timeout">(r => setTimeout(() => r("timeout"), 90_000));
    try {
      const r = await Promise.race([setupControl(true), gaveUp]);
      if (alive.current) setAsked(r === "timeout" ? { spotify: "waiting", music: "waiting" } : r?.asked);
    } catch {
      if (alive.current) setAsked({ spotify: "waiting", music: "waiting" });
    } finally {
      clearTimeout(slowTimer);
      if (alive.current) { setChose(c => c === "asking" ? "allowed" : c); refresh(); }
    }
  };
  const carryOn = () => { setAsked({ spotify: "waiting", music: "waiting" }); setChose("allowed"); };
  const listenOnly = async () => { await setupControl(false); refresh(); onNext(); };
  // macOS's own answer when it has one; else what asking said (no answer yet, or the app isn't open)
  const shown = (now?: AppPerm, ask?: AskAnswer): AskAnswer | undefined =>
    now === "granted" || now === "denied" || now === "restricted" || now === "not_installed" || !ask || ask === "not_asked" ? now : ask;
  const apps: [string, AskAnswer | undefined][] = [["Spotify", shown(st?.control?.spotify, asked?.spotify)],
                                                   ["Apple Music", shown(st?.control?.music, asked?.music)]];
  const waiting = chose === "allowed" && apps.some(([, p]) => p === "waiting");
  return (
    <>
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">让随声练跟随 Spotify 和 Apple Music</h2>
      </div>
      <span className="mt-2 inline-block rounded-full bg-accent-500/14 px-2 py-0.5 text-[11px] font-medium text-accent-300">推荐</span>
      <p className="mt-3 text-sm text-ink-300">
        这样歌词和音符从歌曲开始时就能对齐，随声练也可以为你播放或重新开始歌曲。
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        随声练只会读取正在播放的歌曲及进度，并控制播放、暂停和跳转。macOS 会分别为每个应用询问一次。
      </p>
      <div className="mt-5 space-y-2">
        {apps.filter(([, p]) => p !== "not_installed").map(([app, p]) => <AppRow key={app} app={app} state={p} />)}
      </div>
      {chose === "asking" && slow && (
        <p className="mt-4 text-xs leading-relaxed text-ink-400" role="status">
          正在等待 macOS 响应。如果 Spotify 或 Apple Music 的授权窗口被挡在后面，请切换到该窗口并作出选择。
          如果没有看到询问，可以继续；首次在该应用中播放歌曲时，macOS 会再次询问。
        </p>
      )}
      {waiting && (
        <p className="mt-4 text-xs leading-relaxed text-ink-400" role="status">
          macOS 尚未返回授权结果。如果授权窗口已显示，请作出选择；否则首次在该应用中播放歌曲时会再次询问。
        </p>
      )}
      <div className="mt-6 flex items-center justify-between">
        <Quiet onClick={listenOnly}>{chose === "allowed" ? "" : "仅听歌，不控制应用"}</Quiet>
        {chose === "allowed"
          ? <Primary onClick={onNext}>继续</Primary>
          : chose === "asking" && slow
          ? <Primary onClick={carryOn}>继续等待</Primary>
          : <button ref={allowRef} onClick={allow} disabled={chose === "asking"}
                    className="rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-accent-400 focus-visible:ring-2 focus-visible:ring-accent-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900 disabled:opacity-50">
              {chose === "asking" ? "正在请求…" : "允许"}
            </button>}
      </div>
    </>
  );
}

function AppRow({ app, state }: { app: string; state?: AskAnswer }) {
  const granted = state === "granted";
  const denied = state === "denied";
  const restricted = state === "restricted";
  const label = granted ? "已允许" : denied ? "未允许" : restricted ? "受设备管理策略限制" : state === "not_running" ? "首次在此应用播放歌曲时询问"
    : state === "waiting" ? "尚未收到答复" : state === "ask" || state === "not_asked" ? "尚未请求" : state === "unknown" ? "状态未知" : "";
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${granted ? "border-good/25 bg-good/5" : "border-white/8 bg-white/3"}`}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${granted ? "bg-good/20 text-good" : denied ? "bg-off/15 text-off" : "bg-white/8 text-ink-400"}`} aria-hidden>
        {granted ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          : denied ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className="flex-1 font-medium text-ink-100">{app}</span>
      {denied
        ? <button onClick={() => setupOpenSettings("automation")} className="rounded-lg bg-white/8 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:bg-white/12">打开系统设置</button>
        : <span className={`text-xs ${granted ? "font-medium text-good" : "text-ink-400"}`}>{label}</span>}
    </div>
  );
}

function MicCheck({ micOk, onNext, onBack }: { micOk: boolean; onNext: () => void; onBack: () => void }) {
  const [db, setDb] = useState(-120);
  const [heard, setHeard] = useState(false);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  // the microphone being listened to: the same one your takes use (null: none connected)
  const [device, setDevice] = useState<string | null | undefined>(undefined);
  const loudSince = useRef<number | null>(null);
  const floor = useRef(0);
  useEffect(() => {
    if (!micOk) return;
    let alive = true, raf = 0;
    floor.current = 0;
    getMics().then(m => { if (alive && m) setDevice(m.chosen?.name ?? null); }).catch(() => {});
    // the meter couldn't start, or stopped answering: say so ("No microphone") rather than leave the bar stuck
    const fail = () => { if (alive) { setRunning(false); setFailed(true); } };
    setupMeter(true).then(ok => {
      if (!alive) return;
      setRunning(ok);
      setFailed(!ok);
      const tick = async () => {
        let v: number;
        try { v = await setupLevel(); } catch { fail(); return; }
        if (!alive) return;
        setDb(v);
        const now = performance.now();
        // the room's own level, followed slowly upwards and at once downwards: a voice is clearly above it
        if (v > -119) floor.current = floor.current === 0 ? v : Math.min(v, floor.current + 0.05);
        const voice = v > -40 || (floor.current !== 0 && v > floor.current + 15);
        if (voice) { loudSince.current ??= now; if (now - loudSince.current > 300) setHeard(true); }
        else loudSince.current = null;
        raf = window.setTimeout(tick, 60);
      };
      tick();
    }, fail);
    return () => { alive = false; clearTimeout(raf); void setupMeter(false).catch(() => {}); };
  }, [micOk]);
  // -80 to -10 dBFS: a quiet room already moves the bar a little, so you can see the mic is live
  const pct = Math.max(0, Math.min(1, (db + 80) / 70));
  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight">随声练能听到你的声音吗？</h2>
      <p className="mt-2 text-sm text-ink-300">
        {!micOk ? "请先返回并允许随声练使用麦克风。"
          : device === null ? "没有连接麦克风。请连接一个，或前往“系统设置 → 声音 → 输入”选择设备。"
          : "说句话，或唱一个音符。"}
      </p>
      {micOk && device && <p className="mt-1 text-xs text-ink-500">当前使用：{device}。你可以在设置中选择其他设备。</p>}
      <div className="mt-6 flex items-center gap-4">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/6" role="meter" aria-label="麦克风音量" aria-valuemin={-80} aria-valuemax={-10} aria-valuenow={Math.round(db)}>
          <div className={`h-full rounded-full transition-[width] duration-75 ${heard ? "bg-good" : "bg-accent-400"}`} style={{ width: `${pct * 100}%` }} />
        </div>
        <span className={`w-28 text-right text-sm font-medium ${heard ? "text-good" : "text-ink-500"}`}>
          {heard ? "已听到" : running ? "正在监听…" : !micOk ? "未授权" : !failed && device !== null ? "正在启动…" : "没有麦克风"}
        </span>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        使用耳机时音准评估更稳定。也可以使用笔记本扬声器：随声练会从麦克风采集的声音中消除音乐。
      </p>
      <div className="mt-7 flex items-center justify-between">
        <Quiet onClick={onNext}>{heard ? "" : "跳过"}</Quiet>
        {micOk ? <Primary onClick={onNext} disabled={!heard}>继续</Primary>
          : <Primary onClick={onBack}>返回权限设置</Primary>}
      </div>
    </>
  );
}

function Ready({ onFinish }: { onFinish: () => void }) {
  return (
    <>
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-good/15 text-good">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <h2 className="text-center text-2xl font-semibold tracking-tight">设置完成</h2>
      <p className="mx-auto mt-2 max-w-sm text-center text-ink-300">
        在音乐应用中播放一首歌，然后开始演唱。每首歌首次播放时，随声练会学习其旋律。
      </p>
      <p className="mx-auto mt-3 max-w-sm text-center text-sm text-ink-400">
        用舒适的音量演唱：随声练评估音高，不评估音量。嗓子累了就休息，感到疼痛时请停止。
      </p>
      <div className="mt-7 flex justify-center">
        <Primary onClick={onFinish}>开始练习</Primary>
      </div>
    </>
  );
}
