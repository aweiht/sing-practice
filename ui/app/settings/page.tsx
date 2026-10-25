"use client";
// Settings: every switch is something you allow. "Let OnKey control" Spotify, Apple Music (on by default) and YouTube in
// your browser (opt-in): all three off is listening only (settings.rs `listen_only`; there's no switch of its own). Then
// "Use Shazam to name new songs" (on by default; off, nothing is sent to Apple), "Show lyrics" (on by default; off, LRCLIB
// isn't asked) and the microphone. (The output timing check, components/TimingCheck.tsx, is retired: see
// timing::CHECK_RETIRED.)
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, Nav } from "@/components/Nav";
import { reportProblem } from "@/components/ReportProblem";
import { allowControl, getMics, getSettings, openLink, setMic, setSetting, setupControl, setYouTube, type Mics, type Settings } from "@/lib/session";

/** Which microphone OnKey listens to: automatic (the Mac's input, as chosen in System Settings → Sound) or one
 *  picked here. Setup's mic check and your takes use the same one. */
function MicPicker() {
  const [m, setM] = useState<Mics | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => getMics().then(v => { if (alive) setM(v); }).catch(() => {});
    load();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 3000);   // a mic plugged in or out shows up
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!m) return null;
  const missing = m.preferred != null && !m.devices.some(d => d.uid === m.preferred);
  const pick = async (uid: string) => { await setMic(uid === "" ? null : uid); setM(await getMics()); };
  return (
    <>
      <h2 className="mt-8 mb-2 px-1 text-sm font-medium text-ink-200">麦克风</h2>
      <section className="glass overflow-hidden rounded-3xl">
        <div className="flex items-start justify-between gap-6 px-5 py-4">
          <div className="min-w-0">
            <label htmlFor="set-mic" className="text-sm font-medium text-ink-100">使用设备</label>
            <p className="mt-1 text-xs text-ink-400">
              {m.chosen ? <>当前设备：{m.chosen.name}。</> : <span className="text-amber-200">未连接麦克风。</span>}{" "}
              {missing ? "所选麦克风当前未连接，连接前随声练会使用 Mac 的默认输入设备。" : ""}
              自动模式使用 Mac 当前的输入设备（系统设置 → 声音）。如果 Mac 已有内置麦克风，蓝牙耳机的麦克风不会启用，音乐可保持完整音质。
            </p>
          </div>
          <select id="set-mic" value={m.preferred ?? ""} onChange={e => pick(e.target.value)}
                  className="mt-0.5 max-w-56 shrink-0 rounded-lg border border-white/8 bg-white/4 px-2.5 py-1.5 text-sm text-ink-100 outline-none focus:border-accent-400">
            <option value="">自动选择</option>
            {m.devices.map(d => <option key={d.uid} value={d.uid}>{d.name}</option>)}
            {missing && <option value={m.preferred!}>未连接</option>}
          </select>
        </div>
      </section>
    </>
  );
}

/** Auto-update is disabled for unsigned builds; users can inspect the source and version at the repository. */
function VersionInfo({ version }: { version?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/6 px-5 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-100">随声练 {version ?? "版本未知"}</div>
        <p className="mt-1 text-xs text-ink-400">此版本不会自动更新。请前往项目仓库查看源码和可用版本。</p>
      </div>
      <button onClick={() => void openLink("https://github.com/aweiht/sing-practice")}
              className="shrink-0 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-sm text-ink-100 transition hover:bg-white/8">查看项目仓库</button>
    </div>
  );
}

function Row({ id, title, sub, on, onChange, badge, warn, disabled }: {
  id: string; title: string; sub: string; on: boolean; onChange: (on: boolean) => void; badge?: string; warn?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/6 px-5 py-4 last:border-0">
      <div className="min-w-0">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink-100">
          {title}
          {badge && <span className={`rounded-full px-1.5 py-px text-[10px] font-normal ${warn ? "bg-amber-400/12 text-amber-200" : "bg-white/6 text-ink-300"}`}>{badge}</span>}
        </label>
        <p className="mt-1 text-xs text-ink-400">{sub}</p>
      </div>
      <button id={id} role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
              className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition disabled:opacity-40 ${on ? "bg-accent-500" : "bg-white/12"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { getSettings().then(setS).catch(() => setS(null)); }, []);
  // listening only: Spotify, Apple Music and YouTube all off (settings.rs `listen_only`)
  const listenOnly = !!s?.listen_only;
  const change = async (key: Exclude<keyof Settings, "version" | "small_mac" | "listen_only">, on: boolean) => {
    if (key === "youtube") await setYouTube(on);
    else if (key === "keep_models" || key === "battery_30fps" || key === "voice_breaks" || key === "shazam" || key === "show_lyrics") await setSetting(key, on);
    else if ((key === "control_spotify" || key === "control_music") && !on && s && !s.listening) {
      // the older way (following the apps by asking them, which controls both): turning one off moves to listening,
      // with the other app still allowed, as the old "Listen only" switch's way out did
      await setupControl(true);
      await setSetting(key, false);
    }
    else if (on && key !== "listening") await allowControl(key);
    else await setSetting(key, on);
    setS(await getSettings());
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      <header data-tauri-drag-region className="app-header flex items-center gap-5 px-6 pt-4 pb-3"><Logo /><Nav /></header>
      <main className="mx-auto max-w-2xl px-6 pb-16">
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">设置</h1>
        {!s ? <div className="glass mt-6 h-40 rounded-3xl shimmer" /> : (
          <>
            <h2 className="mt-6 mb-2 px-1 text-sm font-medium text-ink-200">允许随声练控制</h2>
            <p className="mb-3 px-1 text-xs text-ink-400">
              {s.listening
                ? "默认开启后，随声练可读取当前播放内容和精确进度，并控制播放、暂停、定位和启动歌曲。macOS 会分别请求授权。"
                : "随声练通过向 Spotify 和 Apple Music 查询播放信息来跟随歌曲，并可控制这些应用。"}
            </p>
            <section className="glass overflow-hidden rounded-3xl">
              <Row id="set-spotify" title="Spotify" on={!s.listening || s.control_spotify} onChange={on => change("control_spotify", on)}
                   sub="在随声练中启动、暂停或切换 Spotify 歌曲。" />
              <Row id="set-music" title="Apple Music" on={!s.listening || s.control_music} onChange={on => change("control_music", on)}
                   sub="控制“音乐”App 中的歌曲，也包括你的资料库。" />
              <Row id="set-youtube" title="浏览器中的 YouTube" badge="需要较高权限" warn on={s.youtube} onChange={on => change("youtube", on)}
                   sub="允许随声练读取并控制 Chrome、Brave、Edge 或 Safari 中的 YouTube 标签页。需要在浏览器设置中启用“允许来自 Apple 事件的 JavaScript”。" />
            </section>
            {s.listening && (
              <p role="status" className="mt-3 px-1 text-xs text-ink-400">
                {listenOnly
                  ? <>随声练当前仅监听声音来跟随歌曲，不会操作其他 App。播放进度可能不够精确，也无法启动或重新播放歌曲。在这里关闭 App 控制不会撤销 macOS 权限；请前往“系统设置 → 隐私与安全性 → 自动化”管理权限。</>
                  : "关闭以上所有选项后，随声练只会通过声音跟随歌曲。"}
              </p>
            )}
            <section className="glass mt-8 overflow-hidden rounded-3xl">
              <Row id="set-shazam" title="使用 Shazam 识别新歌曲" on={s.shazam !== false} onChange={on => change("shazam", on)}
                   sub="你以前唱过的歌曲会在这台 Mac 上识别。随声练控制 Spotify 和 Apple Music 时，新歌曲由对应 App 提供名称；其他歌曲由 Shazam 根据声音的短音频指纹（不含音频本身）识别。关闭后不会向 Apple 发送数据，这里只能识别本机已学习的歌曲。" />
              {s.listening && !s.control_spotify && !s.control_music && s.shazam === false && (
                <p role="status" className="bg-amber-400/8 px-5 py-3 text-xs text-amber-200">
                  Spotify 和 Apple Music 控制均已关闭。只有开启 Shazam 才能学习新歌曲；本机已学习的歌曲仍可使用。
                </p>
              )}
            </section>
            <h2 className="mt-8 mb-2 px-1 text-sm font-medium text-ink-200">歌词</h2>
            <section className="glass overflow-hidden rounded-3xl">
              <Row id="set-show-lyrics" title="显示歌词" on={s.show_lyrics !== false} onChange={on => change("show_lyrics", on)}
                   sub="歌词来自免费的社区歌词库 LRCLIB。关闭后，随声练不会向 LRCLIB 请求歌词；你仍可跟着音高提示演唱并查看评分。" />
            </section>
          </>
        )}
        <MicPicker />
        {s && (
          <>
            <h2 className="mt-8 mb-2 px-1 text-sm font-medium text-ink-200">声音保护</h2>
            <section className="glass overflow-hidden rounded-3xl">
              <Row id="set-voice-breaks" title="提醒我休息嗓子" on={s.voice_breaks !== false} onChange={on => change("voice_breaks", on)}
                   sub="连续演唱约 35 分钟后会轻声提醒你休息。停止演唱 20 分钟后，计时会重新开始。" />
            </section>
            <h2 className="mt-8 mb-2 px-1 text-sm font-medium text-ink-200">性能</h2>
            <section className="glass overflow-hidden rounded-3xl">
              <Row id="set-battery-30" title="使用电池时节省电量" on={s.battery_30fps !== false} onChange={on => change("battery_30fps", on)}
                   sub="使用电池时，每秒绘制 30 次音符（平时为 60 次），减少一半绘制工作量，同时保持画面流畅。" />
              {!s.small_mac && <Row id="set-keep-models" title="保持学习模型就绪" on={!!s.keep_models} onChange={on => change("keep_models", on)}
                   sub="学习新歌曲会更快，但会额外占用约 1.5 GB 内存，唱已认识的歌曲时也会占用。关闭后，只有学习新歌时才加载模型，完成后会释放。内存达到 32 GB 的 Mac 默认开启。" />}
            </section>
          </>
        )}
        <h2 className="mt-8 mb-2 px-1 text-sm font-medium text-ink-200">关于</h2>
        <section className="glass overflow-hidden rounded-3xl">
          <VersionInfo version={s?.version} />
          <button onClick={() => reportProblem()} className="flex w-full items-center justify-between gap-6 border-b border-white/6 px-5 py-4 text-left text-sm text-ink-100 hover:bg-white/4">
            <span>
              报告问题
              <span className="mt-1 block text-xs text-ink-400">将随声练的日志和时间数据保存为 ZIP，供你附加到 GitHub 问题中。发送前可先查看文件内容；其中不含歌词或音频，也不会自动上传。</span>
            </span>
            <span aria-hidden className="text-ink-400">›</span>
          </button>
          <button onClick={() => void openLink("https://github.com/aweiht/sing-practice/issues")}
                  className="flex w-full items-center justify-between gap-6 border-b border-white/6 px-5 py-4 text-left text-sm text-ink-100 hover:bg-white/4">
            <span>
              帮助与问题反馈
              <span className="mt-1 block text-xs text-ink-400">在项目问题区查看帮助、反馈歌曲识别问题或提出建议。</span>
            </span>
            <span aria-hidden className="text-ink-400">↗</span>
          </button>
          <div className="flex items-center gap-3 border-b border-white/6 px-5 py-4 text-sm text-ink-100">
            <img src="/dsmurrell.png" alt="" width={20} height={20} className="rounded" />
            <span>
              上游项目：<a href="https://github.com/dsmurrell/onkey" onClick={e => { e.preventDefault(); void openLink("https://github.com/dsmurrell/onkey"); }}
                         className="underline-offset-2 hover:underline">OnKey（Daniel Murrell）</a>
              <span className="mt-1 block text-xs italic text-ink-500">感谢原作者的开源项目。</span>
            </span>
          </div>
          <Link href="/licences" className="flex items-center justify-between gap-6 px-5 py-4 text-sm text-ink-100 hover:bg-white/4">
            <span>
              开源许可证
              <span className="mt-1 block text-xs text-ink-400">查看随声练使用的模型、数据、字体、软件库及其许可证。</span>
            </span>
            <span aria-hidden className="text-ink-400">›</span>
          </Link>
        </section>
        <p className="mt-3 px-1 text-xs text-ink-400">
          随声练供个人在家练习使用。学习到的歌曲信息保存在这台 Mac 上，请妥善保管；请勿发布包含音乐的演唱记录或屏幕录像。
        </p>
      </main>
    </div>
  );
}
