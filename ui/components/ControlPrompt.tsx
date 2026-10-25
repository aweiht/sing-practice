"use client";
// Listening mode: OnKey follows songs by listening and controls no app until you allow it. When you use a
// control (start a song, skip to the singing, pause from OnKey) for an app you haven't allowed, this asks:
// allow control of that app (macOS then asks once too), or open the song there and press play yourself.
import { useEffect, useState } from "react";
import { allowControl, goHome, openInApp, type ControlNeeded } from "@/lib/session";

export default function ControlPrompt() {
  const [ask, setAsk] = useState<ControlNeeded | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setAsk((e as CustomEvent<ControlNeeded>).detail);
    window.addEventListener("onkey-control-needed", on);
    return () => window.removeEventListener("onkey-control-needed", on);
  }, []);
  useEffect(() => {
    if (!ask) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAsk(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [ask]);
  if (!ask) return null;
  const browser = ask.key === "youtube";
  const canAllow = ask.key !== "";

  async function allow() {
    if (!ask) return;
    setBusy(true);
    await allowControl(ask.key);
    setAsk(null);
    setBusy(false);
    await ask.retry();
  }
  async function open() {
    if (!ask?.track) return;
    await openInApp(ask.track);
    const home = ask.home;
    setAsk(null);
    if (home) goHome();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-6" onClick={() => setAsk(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="control-title" onClick={e => e.stopPropagation()}
           className="glass w-full max-w-md rounded-3xl p-6 shadow-2xl animate-rise">
        <h2 id="control-title" className="text-lg font-semibold tracking-tight">
          {canAllow ? `允许随声练控制 ${ask.app}？` : `随声练无法控制 ${ask.app}`}
        </h2>
        <p className="mt-2 text-sm text-ink-300">
          {canAllow
            ? `当前随声练只会聆听 ${ask.app}，不会控制它。要从随声练开始播放、跳到演唱段落或暂停歌曲，需要允许控制；macOS 也会向你询问一次。`
            : `随声练会聆听 ${ask.app}，但不会控制它。请在该应用中播放、暂停或切歌。`}
        </p>
        {browser && (
          <p className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            这项权限的范围较大：随声练可以读取并控制浏览器中的 YouTube 标签页。你还需要在浏览器中开启“允许来自 Apple 事件的 JavaScript”。
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={() => setAsk(null)} className="rounded-xl px-4 py-2 text-sm text-ink-300 transition hover:text-white">暂不允许</button>
          {ask.track && (
            <button onClick={open} className="rounded-xl bg-white/8 px-4 py-2 text-sm text-ink-100 transition hover:bg-white/12">
              在{browser ? "浏览器" : ` ${ask.app}`}中打开
            </button>
          )}
          {canAllow && (
            <button disabled={busy} onClick={allow}
                    className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-400 disabled:opacity-50">
              允许控制
            </button>
          )}
        </div>
        <p className="mt-4 text-[11px] text-ink-500">你可以随时在“设置”中更改此选项。</p>
      </div>
    </div>
  );
}
