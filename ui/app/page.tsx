"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Lane, { KEYS_W, NOW_AT } from "@/components/Lane";
import Dancer, { useDancer } from "@/components/Dancer";
import Cover, { SourceLinks } from "@/components/Cover";
import Setup from "@/components/Setup";
import StarterSongs, { StarterSheet, useStartersHidden } from "@/components/StarterSongs";
import VoiceBreak from "@/components/VoiceBreak";
import Heart from "@/components/Heart";
import { DevCopy, logTime, takeLink } from "@/components/Dev";
import { Logo, Nav } from "@/components/Nav";
import { FinishSong, SingSwitches, Icon, Lyrics, ScoreAndHint, SkipToSinging, SongClock, StatusChips, TakeToast, Transport, useTick } from "@/components/LiveBits";
import { getLibrary, inApp, learnAnyway, isFavorite, learnPct, learnStage, live, openApp, startingSong, openPrivacySettings, playerNow, renameTrack, setFavorite, setMini, setupOpenSettings, setupStatus, setYouTube, usePlaying, useSession, type LearnJob, type Line, type SongState, type Status } from "@/lib/session";
import { typing } from "@/lib/keys";
import { clock, sourceName } from "@/lib/music";

export default function Sing() {
  useEffect(() => { live.start(); }, []);
  const { song: playing, connected, status, ended, takes, problem, score, line, learning, drowned, notSong } = useSession();
  // listening mode, the song changed (or isn't named yet): the old one goes at once, the status line says what's happening
  const finding = !!line && line.kind !== "learning";
  const song = finding ? null : playing;
  // the app the song plays in (listening mode: the one heard; a Shazam match's id doesn't say)
  // the app it opens in when it was kept by its ISRC (as "Open in your music app" does), else its id's
  const [opensIn, setOpensIn] = useState<{ id: string; app: string } | null>(null);
  const songId = song?.track.id;
  useEffect(() => {
    if (!songId || !inApp()) return;
    let gone = false;
    openApp(songId).then(app => { if (!gone && app) setOpensIn({ id: songId, app }); }).catch(() => {});
    return () => { gone = true; };
  }, [songId]);
  const source = status.player?.app && status.player.app !== "your music app" ? status.player.app
    : song ? (opensIn?.id === song.track.id ? opensIn.app : sourceName(song.track.id)) : "";
  const [mini, setMiniState] = useState(false);
  const [app, setApp] = useState(false);              // known only in the browser (the page is prerendered)
  useEffect(() => setApp(inApp()), []);
  // first-run setup: opens by itself until it's been finished (in the browser, with ?setup)
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(location.search).has("setup")) { setSetup(true); return; }
    if (inApp()) setupStatus().then(s => { if (!s.done) setSetup(true); }).catch(() => {});
  }, []);
  const toggleMini = (on: boolean) => { setMiniState(on); void setMini(on); };
  // the song's heart (F)
  const [fav, setFav] = useState<{ id: string; on: boolean } | null>(null);
  const track = song?.track;
  useEffect(() => {
    if (!track) return;
    let gone = false;
    isFavorite(track).then(on => { if (!gone) setFav({ id: track.id, on }); }).catch(() => {});
    return () => { gone = true; };
  }, [track?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const favOn = !!track && fav?.id === track.id && fav.on;
  const toggleFav = (on: boolean) => { if (!track) return; setFav({ id: track.id, on }); void setFavorite(track, on); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey) return;
      if (e.key === "m" || e.key === "M") toggleMini(!mini);
      else if ((e.key === "f" || e.key === "F") && track) toggleFav(!favOn);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });
  if (mini) return <Mini onExpand={() => toggleMini(false)} />;
  return (
    <div className="flex h-dvh flex-col overflow-clip bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      {/* overflow-clip (not hidden) and minmax(0, ...) tracks: nothing can widen the page or scroll it sideways,
          so the lane, lyrics and controls stay centred in the window */}
      <VoiceBreak />
      <StarterSheet />
      <header data-tauri-drag-region className="app-header grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-4 px-6 pt-4 pb-3">
        <div className="flex min-w-0 items-center gap-5 overflow-clip"><Logo /><Nav /></div>
        <div className="min-w-0 text-center">
          {!song && line && <StatusLine line={line} />}
          {!song && <LearningLine jobs={learning} className={line ? "mt-1.5" : ""} />}
          {song && (
            <div key={song.version} className="flex animate-rise items-center justify-center gap-3">
              <Cover name={song.track.name} art={song.track.art} link={song.track.link} size={40} eager />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold tracking-tight">{song.track.name}</span>
                  <Heart on={favOn} onToggle={toggleFav} size={14} className="-my-1.5 h-6 w-6" />
                  {song.track.id.startsWith("youtube:") && <RenameVideo id={song.track.id} artist={song.track.artist} name={song.track.name} />}
                  <DevCopy label="复制链接" text={async () => {
                    const n = await playerNow().catch(() => null);
                    return takeLink("live", song.version, { song: n?.position, track: song.track.id, mode: song.mode, at: logTime() });
                  }} />
                </div>
                <div className="flex items-center gap-2 truncate text-sm text-ink-400">
                  {song.track.artist}<span className="text-ink-600">·</span><SongClock />
                  {/* the app it plays from, as the link to the song there; then the other service, dimmer */}
                  <span className="text-ink-600">·</span><SourceLinks source={source} artist={song.track.artist} name={song.track.name} appleLink={song.track.link} trackId={song.track.id} />
                </div>
                {line?.kind === "learning" && <div role="status" className="mt-0.5 truncate text-xs text-accent-300">{line.text}</div>}
                {/* (earlier songs still being learned aren't shown over a playing song: it crowded the header; the
                    Library shows their progress) */}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-4">
          {song && <ScoreAndHint />}
          {app && (
            <button onClick={() => toggleMini(true)} title="迷你模式：置顶显示歌词栏（M）"
                    className="grid h-9 w-9 place-items-center rounded-full text-ink-300 transition hover:bg-white/8 hover:text-white">
              <Icon d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM12.5 11.5h5.5v4.5h-5.5z" size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="relative mx-4 min-h-0 flex-1 overflow-clip rounded-3xl border border-white/6 bg-ink-900 shadow-2xl shadow-black/40">
        {!finding && <Lane />}
        {!ended && !finding && <Dancer />}
        {song && !ended && <SkipToSinging />}
        {song && !ended && <FinishSong />}
        {song?.mode === "learn" && <Learning key={song.version} />}
        {!song && <Waiting connected={connected} line={line} player={status.player} youtube={!!status.youtube} listening={!!status.listening} onSetup={() => setSetup(true)} />}
        {!setup && <Notices status={status} song={song} />}
        {!setup && song?.mode === "sing" && !ended && drowned && <SpeakerHint key={song.version} id={song.track.id} />}
        {!setup && notSong && <NotASong key={notSong.track_id} id={notSong.track_id} name={notSong.name} />}
        {ended && !finding && <Ended takes={takes} />}
        {(problem === "permission" || status.audio === "denied" || status.audio === "restricted") && !setup && <NeedsPermission app={status.player?.app ?? "音乐应用"} />}
      </main>
      {setup && <Setup onClose={() => setSetup(false)} />}

      <section className="pt-5 pb-3">{song && <Lyrics />}</section>

      <footer className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-4 px-6 pb-5">
        <StatusChips />
        <Transport />
        <div className="flex min-w-0 items-end justify-end gap-2"><TakeToast />{!ended && <SingSwitches />}</div>
      </footer>
    </div>
  );
}

function Learning() {
  useTick(500);
  const playing = usePlaying();     // the dot pulses only while the song plays
  const song = live.song!;
  const perf = live.frozenPerf ?? performance.now();
  const t = live.songTime(perf);
  const d = song.track.duration;     // 0 when unknown (YouTube can say so): no bar, and the time without a length
  const pct = d > 0 ? Math.max(0, Math.min(1, t / d)) : null;
  const dot = <span className="relative flex h-2 w-2 shrink-0"><span className={`absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-60 motion-reduce:hidden ${playing ? "animate-ping" : "hidden"}`} /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" /></span>;
  const bar = (h: string) => pct != null && (
    <div className={`${h} overflow-hidden rounded-full bg-white/9`}>
      <div className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-600 transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
    </div>
  );
  // in the future side of the lane (right of the now line), where nothing is known yet
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: `calc(${KEYS_W}px + (100% - ${KEYS_W}px) * ${NOW_AT})` }}>
      <div className={`frost absolute top-1/2 left-1/2 w-[min(calc(100%-40px),300px)] rounded-[22px] px-[18px] pt-4 pb-3.5 text-center -translate-x-1/2 -translate-y-1/2`}>
        <div className="mx-auto mb-2.5 flex w-fit items-center gap-2 rounded-full bg-accent-500/14 px-3 py-1 text-xs font-medium text-accent-300">{dot}正在学习这首歌</div>
        <h2 className="text-base font-semibold tracking-tight">本次盲唱</h2>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-200/85">跟着歌曲演唱，不显示提示。下次练习时会提前显示每个音符。</p>
        {bar("mt-3 h-1")}
        <div className="mt-2 text-[11.5px] text-ink-300"><span className="tabular">{clock(t)}{d > 0 && ` / ${clock(d)}`}</span> · 歌曲结束后评分</div>
      </div>
    </div>
  );
}

/** Listening mode's status line, in the header while no song is shown: what OnKey is doing about the sound. */
function StatusLine({ line }: { line: Line }) {
  const busy = line.kind === "finding" || line.kind === "new_song";
  return (
    <div key={line.text} role="status" aria-live="polite"
         className={`mx-auto flex w-fit animate-rise items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${busy ? "bg-accent-500/12 text-accent-300" : "bg-white/6 text-ink-300"}`}>
      {busy && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-accent-400" /></span>}
      {line.text}
    </div>
  );
}

/** Songs whose play is over still being learned (the status line's learning part): which, what it's doing and how
 *  far it's got, as a thin bar that moves only when the engine reports (see LearnBar). The song being learned is
 *  the one shown; one waiting behind it (one is learned at a time) is only counted. */
function LearningLine({ jobs, className = "" }: { jobs: LearnJob[]; className?: string }) {
  const after = jobs.filter(j => j.fraction != null);
  if (!after.length) return null;
  const j = after.find(a => a.stage !== "queued") ?? after[0], pct = learnPct(j);
  return (
    <div role="status" aria-live="polite" className={`mx-auto w-72 max-w-full text-left text-xs ${className}`}
         title={after.length > 1 ? after.map(a => a.name).join(", ") : undefined}>
      <div className="flex items-baseline gap-1.5">
        {pct == null
          ? <span className="truncate text-ink-300">等待学习：<span className="text-ink-100">{j.name}</span></span>
          : <span className="truncate text-ink-300">正在学习：<span className="text-ink-100">{j.name}</span> · {learnStage(j)}</span>}
        <span className="tabular ml-auto shrink-0 text-ink-400">{after.length > 1 ? `+${after.length - 1}` : ""}{after.length > 1 && pct != null ? " · " : ""}{pct != null ? `${pct}%` : ""}</span>
      </div>
      <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-white/8">
        {pct != null && <div className="h-full rounded-full bg-accent-400 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(2, pct)}%` }} />}
      </div>
    </div>
  );
}

/** What the status line means, said under it while waiting. */
const LINE_SUB: Record<Line["kind"], string> = {
  finding: "正在根据声音识别歌曲，需要几秒钟；本次记录会从歌曲开头开始。",
  new_song: "正在识别下一首歌；本次记录会从歌曲开头开始。",
  unnamed: "随声练和 Shazam 都无法识别这首歌。声音变化后，随声练会再次尝试。",
  no_shazam: "暂时无法连接 Shazam，目前只能识别这台 Mac 上已学习的歌曲。随声练会继续尝试。",
  shazam_off: "Shazam 已关闭（可在“设置”中开启），因此只能通过声音识别这台 Mac 上已学习的歌曲。开启 Shazam 后即可识别新歌。",
  podcast: "播放歌曲，随声练就会跟随演唱。",
  learning: "",
  elsewhere: "随声练会听取这台 Mac 上播放的声音。如果歌曲正在手机或音箱等其他设备播放，请在音乐 App 的设备菜单中切换到这台 Mac。",
};

/** First run (nothing learned yet) and still no song after this long: suggest songs to try, whatever the line says. */
const STARTERS_AFTER_MS = 45_000;

function Waiting({ connected, line, player, youtube, listening, onSetup }: { connected: boolean; line: Line | null; player: null | { state: string; name: string; artist: string }; youtube: boolean; listening: boolean; onSetup: () => void }) {
  const [busy, setBusy] = useState(false);
  const said = line && line.kind !== "learning" ? line : null;
  // songs to try: while nothing plays, and on a first run when OnKey has heard no song for a while
  const [startersHidden, hideStarters] = useStartersHidden();
  const [firstRun, setFirstRun] = useState(false);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    let gone = false;
    getLibrary().then(l => { if (!gone) setFirstRun(l.length === 0); }).catch(() => {});
    const t = setTimeout(() => setWaited(true), STARTERS_AFTER_MS);
    return () => { gone = true; clearTimeout(t); };
  }, []);
  // a song just started from the Library, History or a take: say so until it plays (not the nothing-playing screen)
  const [start, setStart] = useState(startingSong);
  useEffect(() => {
    if (!start) return;
    const t = setTimeout(() => setStart(startingSong()), 1000);
    return () => clearTimeout(t);
  }, [start]);
  const idle = !said && player?.state !== "playing" && !start;
  const starters = connected && startersHidden === false && (idle || (firstRun && waited && !start));
  const title = !connected ? "正在启动随声练…" : start ? (start.name ? `正在启动：${start.name}…` : "正在启动歌曲…") : said ? (said.kind === "finding" || said.kind === "new_song" ? "正在准备…" : said.kind === "podcast" ? "这不是歌曲" : said.kind === "elsewhere" ? said.text : "仍在聆听") : player?.state === "playing" ? "正在准备…"
    : youtube ? "在 Spotify、Apple Music 或 YouTube 中播放歌曲" : "在 Spotify 或 Apple Music 中播放歌曲";
  const sub = !connected
    ? "正在连接这台 Mac 上的音频引擎。"
    : start
      ? "歌曲开始播放后，音高轨迹就会显示。"
    : said
      ? LINE_SUB[said.kind]
      : player?.state === "playing"
        ? `正在聆听 ${player.name}，音高轨迹马上显示。`
        : "随声练会自动跟随播放内容。跟着歌曲演唱，每次练习都会生成可回看的记录。";
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-6">
      <div className="flex w-full max-w-2xl flex-col items-center">
      <div className="max-w-md text-center animate-rise">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-accent-500/12 text-accent-300">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-ink-300">{sub}</p>
        <div className="mt-6 flex justify-center gap-4 text-xs text-ink-400">
          <span><Kbd>空格</Kbd>播放/暂停</span><span><Kbd>R</Kbd>重新开始</span><span><Kbd>←</Kbd><Kbd>→</Kbd>切歌</span><span><Kbd>F</Kbd>收藏</span>
        </div>
        {/* the YouTube switch; when listening, only while it's off (songs in a browser aren't picked up until it's on) */}
        {connected && (!listening || !youtube) && (
          <div className="mx-auto mt-8 max-w-sm rounded-xl border border-white/6 px-4 py-3 text-left text-xs text-ink-400">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-ink-200">YouTube 和 YouTube Music <span className="ml-1 rounded-full bg-white/6 px-1.5 py-px text-[10px] font-normal text-ink-300">实验功能</span></span>
              <button disabled={busy} onClick={async () => { setBusy(true); await setYouTube(!youtube); setBusy(false); }}
                      className="shrink-0 rounded-lg bg-white/6 px-2.5 py-1 text-ink-100 transition hover:bg-white/10 disabled:opacity-50">
                {youtube ? "关闭" : "开启"}</button>
            </div>
            <p className="mt-1.5">{youtube
              ? "已开启。macOS 会询问一次是否允许随声练控制浏览器，以读取视频播放进度。"
              : "尚未开启，因此无法跟随浏览器中的歌曲。开启后即可在 Chrome、Safari、Brave 或 Edge 中跟唱；macOS 会询问是否允许随声练控制浏览器。"}</p>
          </div>
        )}
        <button onClick={onSetup} className="mt-5 text-xs text-ink-500 transition hover:text-ink-200">设置权限并测试麦克风</button>
      </div>
      {starters && <StarterSongs onHide={() => hideStarters(true)} className="mt-8 animate-rise" />}
      {connected && idle && startersHidden && (
        <button onClick={() => hideStarters(false)} className="mt-6 text-xs text-ink-500 transition hover:text-ink-200">推荐练习歌曲</button>
      )}
      </div>
    </div>
  );
}

/** A YouTube video's artist and title are read from the video and can be wrong: fix them here (kept for that
 *  video, and its lyrics are looked up again). */
function RenameVideo({ id, artist, name }: { id: string; artist: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(artist);
  const [n, setN] = useState(name);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setA(artist); setN(name); } }, [open, artist, name]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!n.trim()) return;
    setBusy(true);
    try { await renameTrack(id, a, n); setOpen(false); } finally { setBusy(false); }
  }
  return (
    <span className="relative">
      <button onClick={() => setOpen(o => !o)} title="歌曲名称有误？修改歌手和标题后，随声练会据此查找歌词。"
              className="grid h-6 w-6 place-items-center rounded-full text-ink-500 transition hover:bg-white/8 hover:text-ink-100">
        <Icon d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" size={13} />
      </button>
      {open && (
        <form onSubmit={save} onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
              className="glass absolute left-1/2 top-8 z-30 w-72 -translate-x-1/2 animate-rise rounded-2xl p-4 text-left shadow-2xl shadow-black/50">
          <div className="text-xs font-medium text-ink-200">修改歌曲信息</div>
          <p className="mt-0.5 text-xs text-ink-400">信息读取自 YouTube 视频。随声练会用此名称查找歌词。</p>
          <label className="mt-3 block text-[11px] text-ink-400" htmlFor="rename-artist">歌手</label>
          <input id="rename-artist" value={a} onChange={e => setA(e.target.value)} autoFocus
                 className="mt-1 w-full rounded-lg border border-white/8 bg-white/4 px-2.5 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-400" />
          <label className="mt-2 block text-[11px] text-ink-400" htmlFor="rename-title">歌曲名称</label>
          <input id="rename-title" value={n} onChange={e => setN(e.target.value)}
                 className="mt-1 w-full rounded-lg border border-white/8 bg-white/4 px-2.5 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-400" />
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-ink-300 transition hover:text-ink-100">取消</button>
            <button type="submit" disabled={busy || !n.trim()}
                    className="rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-400 disabled:opacity-50">保存</button>
          </div>
        </form>
      )}
    </span>
  );
}

/** Something OnKey can't do until you change a setting, said with what to do: a permission macOS refused, the
 *  learning models missing, or a browser's JavaScript setting. Never a silent nothing. */
function Notices({ status, song }: { status: Status; song: SongState | null }) {
  const m = status.models;
  // the YouTube hint: gone once turned on (status follows within a few seconds), or for this browser when closed
  const [ytOn, setYtOn] = useState(false);
  const [ytClosed, setYtClosed] = useState<string | null>(null);
  const sounding = status.browser_sounding;
  useEffect(() => { if (status.youtube) setYtOn(false); }, [status.youtube]);
  const learning = !song || song.mode === "learn";
  const list = [
    (status.mic === "denied" || status.mic === "restricted") && (
      <Notice key="mic" title="随声练无法使用麦克风"
              action={status.mic === "denied" ? { label: "打开系统设置", run: () => setupOpenSettings("mic") } : undefined}>
        {status.mic === "denied"
          ? <>授权麦克风后才能听到你的演唱并评分。请前往<b>系统设置 → 隐私与安全性 → 麦克风</b>，允许随声练访问麦克风。</>
          : <>这台 Mac 的设置禁止随声练使用麦克风，请联系设备管理员。</>}
      </Notice>
    ),
    status.mic === "granted" && status.mic_device === null && (
      <Notice key="mic" title="随声练无法听到麦克风">
        当前没有连接麦克风，因此无法听到你的演唱并评分。请连接麦克风，或前往<b>系统设置 → 声音 → 输入</b>选择设备。
      </Notice>
    ),
    status.music_quiet && (
      <Notice key="music-quiet" title={`${status.music_quiet.app} 的音量过低`}>
        随声练无法清楚听到歌曲{status.music_quiet.volume != null ? `（${status.music_quiet.app} 音量为 ${status.music_quiet.volume}%）` : ""}，因此无法评估你的演唱。请调高 {status.music_quiet.app} 的音量，并通过 Mac 调节整体音量。
      </Notice>
    ),
    status.automation_denied && (
      <Notice key="automation" title={`随声练未获准控制 ${status.automation_denied}`}
              action={{ label: "打开系统设置", run: () => setupOpenSettings("automation") }}>
        {status.listening ? "随声练会改为通过声音跟随歌曲，但无法在该应用中启动、暂停或切歌。" : "因此无法读取该应用的播放信息。"}请前往
        <b>系统设置 → 隐私与安全性 → 自动化 → 随声练</b>，允许控制 {status.automation_denied}{status.listening ? <>；也可以在随声练的“设置”中关闭该应用控制。</> : null}。
      </Notice>
    ),
    !status.automation_denied && status.not_answering && (
      <Notice key="not-answering" title={`${status.not_answering} 尚未响应随声练`}
              action={{ label: "打开系统设置", run: () => setupOpenSettings("automation") }}>
        macOS 可能正在询问是否允许随声练控制 {status.not_answering}，但询问窗口被其他窗口遮住了。请找到该窗口并选择<b>允许</b>，或前往<b>系统设置 → 隐私与安全性 → 自动化 → 随声练</b>开启权限。随声练会在一分钟后重试。
      </Notice>
    ),
    m && m.state === "missing" && learning && (
      <Notice key="models" title="随声练暂时无法学习新歌曲">
        App 内置的学习模型缺失或损坏{m.error ? `（${m.error}）` : ""}。已经学习的歌曲仍可使用。请重新下载随声练并替换“应用程序”文件夹中的 App；歌曲和练习记录会保留。
      </Notice>
    ),
    !song && status.youtube_blocked && (
      <Notice key="youtube" title={`要跟唱 YouTube，请允许随声练读取 ${status.youtube_blocked.browser} 中的视频信息`}>
        请在 {status.youtube_blocked.browser} 中选择<b>{status.youtube_blocked.setting}</b>。随声练只读取视频播放进度和歌曲名称，不会读取页面上的其他内容。
      </Notice>
    ),
    !song && !status.youtube && !ytOn && sounding && sounding.browser !== ytClosed && (sounding.works ? (
      <Notice key="youtube-off" title={`正在 ${sounding.browser} 中播放 YouTube 或 YouTube Music？`} onClose={() => setYtClosed(sounding.browser)}
              action={{ label: "开启 YouTube", run: () => { setYtOn(true); void setYouTube(true).catch(() => setYtOn(false)); } }}>
        开启 YouTube 控制后，随声练才能跟随浏览器中的歌曲。macOS 会询问一次是否允许随声练控制 {sounding.browser}，以读取视频播放进度。
      </Notice>
    ) : (
      <Notice key="youtube-off" title={`正在 ${sounding.browser} 中播放 YouTube 或 YouTube Music？`} onClose={() => setYtClosed(sounding.browser)}>
        随声练无法跟随 {sounding.browser} 中的歌曲。请改用<b>Chrome、Safari、Brave 或 Edge</b>，并在此处或“设置”中开启 YouTube 控制；也可以在“设置”中开启<b>仅监听模式</b>，该模式支持所有浏览器。
      </Notice>
    )),
  ].filter(Boolean);
  if (!list.length) return null;
  return <div className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-3 px-6">{list}</div>;
}

/** A gentle hint, once per song in a session: over speakers, when the song has been drowning you out (the engine's
 *  `drowned`: for 20 s of your part the mic heard a voice, but nearly none of it counted as singing). Turning the
 *  music down or headphones lets your voice through; nothing about the score changes. It goes by itself after
 *  20 s, or with ×; "Don't show again" is remembered (localStorage onkey.hideSpeakerHint). */
const speakerHinted = new Set<string>();
const HIDE_SPEAKER_HINT = "onkey.hideSpeakerHint";
/** A YouTube video that sounded like talk, not a song: OnKey stopped learning it (and won't again), unless it's a
 *  song after all. Goes by itself after a while. */
function NotASong({ id, name }: { id: string; name: string }) {
  useEffect(() => {
    const t = setTimeout(() => live.dismissNotSong(), 30000);
    return () => clearTimeout(t);
  }, [id]);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-6">
      <div role="status" className="glass pointer-events-auto w-full max-w-md animate-rise rounded-2xl px-4 py-3 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-ink-200"><span className="text-ink-100">{name}</span> 听起来像对话，不像歌曲，因此随声练已停止学习。</p>
          <button onClick={() => live.dismissNotSong()} aria-label="关闭" className="-mr-1 shrink-0 rounded-md px-1.5 text-ink-400 transition hover:text-ink-100">×</button>
        </div>
        <button onClick={() => void learnAnyway(id)} className="mt-1.5 text-xs text-ink-400 underline-offset-2 transition hover:text-ink-200 hover:underline">这是歌曲：下次播放时继续学习</button>
      </div>
    </div>
  );
}

function SpeakerHint({ id }: { id: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (speakerHinted.has(id)) return;
    try { if (localStorage.getItem(HIDE_SPEAKER_HINT) === "1") return; } catch {}
    speakerHinted.add(id);
    setShown(true);
  }, [id]);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(false), 20000);
    return () => clearTimeout(t);
  }, [shown]);
  if (!shown) return null;
  const never = () => { try { localStorage.setItem(HIDE_SPEAKER_HINT, "1"); } catch {} setShown(false); };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-6">
      <div role="status" className="glass pointer-events-auto w-full max-w-md animate-rise rounded-2xl px-4 py-3 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-ink-200">随声练无法从音乐声中听清你的演唱。如果你正在唱歌，请稍微调低音乐音量或使用耳机，以获得准确评分。</p>
          <button onClick={() => setShown(false)} aria-label="关闭" className="-mr-1 shrink-0 rounded-md px-1.5 text-ink-400 transition hover:text-ink-100">×</button>
        </div>
        <button onClick={never} className="mt-1.5 text-xs text-ink-400 underline-offset-2 transition hover:text-ink-200 hover:underline">不再显示</button>
      </div>
    </div>
  );
}

function Notice({ title, action, onClose, children }: { title: string; action?: { label: string; run: () => void }; onClose?: () => void; children: React.ReactNode }) {
  return (
    <div role="status" className="glass w-full max-w-lg animate-rise rounded-2xl px-5 py-4 shadow-2xl shadow-black/40">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-ink-100">{title}</div>
        <div className="flex shrink-0 items-start gap-1">
          {action && (
            <button onClick={action.run} className="shrink-0 rounded-lg bg-white/8 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:bg-white/12">
              {action.label}
            </button>
          )}
          {onClose && <button onClick={onClose} aria-label="关闭提示" className="-mr-1.5 rounded-md px-1.5 py-1 text-ink-400 transition hover:text-ink-100">×</button>}
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-300 [&_b]:font-medium [&_b]:text-ink-100">{children}</p>
    </div>
  );
}

function Ended({ takes }: { takes: { name: string; artist: string; score: number | null; report: string | null }[] }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink-950/90 p-6">
      <div className="w-full max-w-md animate-rise text-center">
        <h2 className="text-2xl font-semibold tracking-tight">本次练习结束</h2>
        <p className="mt-1 text-ink-300">{takes.length ? "这是本次练习的表现。" : "本次没有足够长、可以评分的演唱记录。"}</p>
        <div className="mt-6 space-y-2 text-left">
          {takes.map((t, i) => (
            <Link key={i} href={t.report ? `/take?id=${encodeURIComponent(t.report)}` : "/history"}
                  className="glass flex items-center justify-between rounded-2xl px-4 py-3 transition hover:border-accent-400/40">
              <div className="min-w-0"><div className="truncate font-medium">{t.name}</div><div className="truncate text-sm text-ink-400">{t.artist}</div></div>
              <div className="tabular text-2xl font-bold">{t.score ?? "–"}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-0.5 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-sans text-[11px] text-ink-200">{children}</kbd>;
}

/** macOS 尚未允许随声练采集其他 App 的系统音频。 */
function NeedsPermission({ app }: { app: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-ink-950/85 px-6">
      <div className="glass w-full max-w-md animate-rise rounded-3xl px-7 py-6 shadow-2xl shadow-black/40">
        <h2 className="text-lg font-semibold tracking-tight">随声练暂时无法听取 {app} 的声音</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          为了跟随歌曲，随声练会采集这台 Mac 上 {app} 的系统音频。音频不会保存或发送；仅监听模式下会将短音频指纹（不含音频本身）发送给 Apple Shazam，用于识别歌曲。
        </p>
        <ol className="mt-4 space-y-1.5 text-sm text-ink-200">
          <li>1. 打开<span className="font-medium">系统设置 → 隐私与安全性</span></li>
          <li>2. 选择<span className="font-medium">屏幕与系统音频录制</span></li>
          <li>3. 在<span className="font-medium">仅系统音频录制</span>下开启随声练</li>
        </ol>
        <button onClick={() => openPrivacySettings()}
                className="mt-5 w-full rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-400">
          打开系统设置
        </button>
      </div>
    </div>
  );
}

/** Mini mode: the current and next lyric line, how close you are to the note, and your score, on a small
 *  rounded card floating above other apps. Drag it anywhere (text doesn't catch the mouse, so the whole card
 *  is a handle); the button opens the full window again. */
function Mini({ onExpand }: { onExpand: () => void }) {
  const { song, score } = useSession();
  const dancerOn = useDancer();
  // the dancer can be hidden from this card alone (the full window's switch is separate), remembered
  const [miniDancer, setMiniDancerState] = useState(true);
  useEffect(() => { try { setMiniDancerState(localStorage.getItem("onkey-mini-dancer") !== "0"); } catch {} }, []);
  const setMiniDancer = (on: boolean) => { setMiniDancerState(on); try { localStorage.setItem("onkey-mini-dancer", on ? "1" : "0"); } catch {} };
  const canDance = dancerOn && song?.mode === "sing" && !!song?.beats?.at.length;
  const dancing = canDance && miniDancer;
  useEffect(() => {
    document.documentElement.classList.add("mini");
    return () => document.documentElement.classList.remove("mini");
  }, []);
  return (
    <div className="h-dvh p-1.5 select-none">
      <div data-tauri-drag-region
           className="relative flex h-full cursor-grab items-stretch gap-2 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 py-2 pr-2 pl-4 shadow-xl shadow-black/50 active:cursor-grabbing">
        <div data-tauri-drag-region className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div data-tauri-drag-region className="flex items-center gap-3">
            <div className="pointer-events-none min-w-0 flex-1">
              {song ? <Lyrics compact /> : <p className="text-sm text-ink-400">在 Spotify 或 Apple Music 中播放歌曲</p>}
            </div>
            <div className="pointer-events-none text-right">
              <div className="tabular text-xl font-bold leading-none">{song?.mode === "learn" ? "–" : score ?? "–"}</div>
              <div className="text-[9px] uppercase tracking-wider text-ink-500">得分</div>
            </div>
          </div>
        </div>
        {dancing && (
          <div className="group relative -my-2 w-[50px] shrink-0">
            <Dancer className="absolute inset-0 h-full w-full" />
            <button onClick={() => setMiniDancer(false)} title="在此隐藏舞者"
                    className="absolute -top-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full text-xs text-ink-400 opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-white">×</button>
          </div>
        )}
        <div className="flex shrink-0 flex-col items-center justify-between">
          <button onClick={onExpand} title="打开完整窗口（M）"
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-300 transition hover:bg-white/8 hover:text-white">
            <Icon d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" size={15} />
          </button>
          {canDance && !miniDancer && (
            <button onClick={() => setMiniDancer(true)} title="显示舞者"
                    className="grid h-7 w-7 place-items-center rounded-full text-ink-400 transition hover:bg-white/8 hover:text-white">
              <Icon d="M12 4.5a1.5 1.5 0 1 0 0 .01M12 7v6M8 9l4 1 4-1M9 21l3-8 3 8" size={15} />
            </button>
          )}
        </div>
        {song && <MiniProgress />}
      </div>
    </div>
  );
}

/** How far through the song: a hairline along the mini card's bottom edge. */
function MiniProgress() {
  useTick(500);
  const song = live.song;
  const d = song?.track.duration ?? 0;
  if (!song || !d) return null;
  const f = Math.max(0, Math.min(1, live.songTime(live.frozenPerf ?? performance.now()) / d));
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/5" title="歌曲进度">
      <div className="h-full bg-accent-400/70 transition-[width] duration-500 ease-linear" style={{ width: `${f * 100}%` }} />
    </div>
  );
}
