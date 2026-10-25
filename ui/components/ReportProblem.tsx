"use client";
// "Report a problem": OnKey's records (logs, each play's summary, versions; never lyrics or audio) put together as a
// zip you save and attach to a GitHub issue. Shows exactly what's in it before saving, with a box to say what went
// wrong. Opened from Settings, the Help menu, and a take's page ("Report a problem with this take"). Nothing is
// uploaded: the issue page opens in your browser and you attach the zip yourself.
import { useEffect, useState } from "react";
import { openReportFolder, openReportIssue, prepareReport, saveReport, showInFinder, type ReportContents } from "@/lib/session";

/** Open the report dialog (about a take, when given). */
export function reportProblem(take?: string) {
  window.dispatchEvent(new CustomEvent("onkey-report", { detail: { take: take ?? null } }));
}

const size = (b: number) => b < 1024 ? `${b} B` : b < 1 << 20 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1 << 20)).toFixed(1)} MB`;

export default function ReportProblem() {
  const [open, setOpen] = useState<{ take: string | null } | null>(null);
  const [contents, setContents] = useState<ReportContents | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setOpen({ take: (e as CustomEvent<{ take: string | null }>).detail?.take ?? null });
    window.addEventListener("onkey-report", on);
    // the Help menu's "Report a Problem…" (the app sends it as an event)
    let off: (() => void) | undefined;
    if ("__TAURI_INTERNALS__" in window) {
      import("@tauri-apps/api/event").then(({ listen }) => listen("onkey-menu", e => { if (e.payload === "report") setOpen({ take: null }); }))
        .then(u => { off = u; }).catch(() => {});
    }
    return () => { window.removeEventListener("onkey-report", on); off?.(); };
  }, []);
  useEffect(() => {
    if (!open) return;
    setContents(null); setError(""); setSaved(null); setText("");
    prepareReport(open.take).then(setContents).catch(() => setError("无法整理问题报告，请稍后重试。"));
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  if (!open) return null;

  async function save() {
    setBusy(true); setError("");
    try {
      const path = await saveReport(text);
      if (path) setSaved(path);
    } catch { setError("保存问题报告失败，请重试。" ); }
    setBusy(false);
  }

  const takes = contents?.files.filter(f => f.name.startsWith("takes/")) ?? [];
  const logs = contents?.files.filter(f => f.name.startsWith("logs/")) ?? [];
  const other = contents?.files.filter(f => !f.name.startsWith("takes/") && !f.name.startsWith("logs/")) ?? [];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-6" onClick={() => setOpen(null)}>
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={e => e.stopPropagation()}
           className="glass flex max-h-[85vh] w-full max-w-xl flex-col rounded-3xl p-6 shadow-2xl animate-rise">
        <h2 id="report-title" className="text-lg font-semibold tracking-tight">
          {open.take ? "报告这次练习的问题" : "报告问题"}
        </h2>
        {saved ? (
          <>
            <p className="mt-2 text-sm text-ink-300">
              已保存到 <span className="font-mono text-xs text-ink-100">{saved}</span>。如需提交，请打开 GitHub 问题页并附上 ZIP 压缩包。
              文件尚未发送到任何地方。
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button onClick={() => showInFinder(saved)} className="rounded-xl bg-white/8 px-4 py-2 text-sm text-ink-100 transition hover:bg-white/12">在访达中显示</button>
              <button onClick={() => openReportIssue(open.take)} className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-400">打开 GitHub 问题页</button>
              <button onClick={() => setOpen(null)} className="rounded-xl px-4 py-2 text-sm text-ink-300 transition hover:text-white">完成</button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-300">
              随声练会将运行记录打包成 ZIP 压缩包，供你保存并手动附加到问题报告中：包含最近三天的日志，以及每次练习的摘要（耗时、CPU、构建版本和 Mac 信息）。
              不包含歌词、音频、歌曲文件、用户名或个人主目录。应用不会自动上传这些内容。
            </p>
            <label htmlFor="report-text" className="mt-4 text-sm font-medium text-ink-100">遇到了什么问题？<span className="font-normal text-ink-400">（选填）</span></label>
            <textarea id="report-text" value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={4000}
                      placeholder="例如：歌词显示偏晚，或应用停在“正在启动”状态"
                      className="mt-1.5 resize-none rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-accent-400" />
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl bg-white/3 px-3 py-2 text-xs text-ink-300">
              {error ? <p className="text-amber-200">{error}</p> : !contents ? <p className="text-ink-400">正在整理报告…</p> : (
                <>
                  <p className="mb-1.5 text-ink-200">压缩包内容（{contents.files.length} 个文件，共 {size(contents.bytes)}）：</p>
                  <ul className="space-y-1">
                    {other.map(f => <li key={f.name}><span className="font-mono text-ink-100">{f.name}</span> · {size(f.bytes)} · {f.what}</li>)}
                    {logs.length > 0 && <li><span className="font-mono text-ink-100">logs/</span> · 随声练最近 {logs.length} 天的日志（{size(logs.reduce((n, f) => n + f.bytes, 0))}）</li>}
                    {takes.map(f => <li key={f.name}><span className="font-mono text-ink-100">{f.name}</span> · {size(f.bytes)} · {f.what}</li>)}
                  </ul>
                </>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => openReportFolder()} disabled={!contents}
                      className="mr-auto rounded-xl px-3 py-2 text-sm text-ink-300 transition hover:text-white disabled:opacity-40">查看文件</button>
              <button onClick={() => setOpen(null)} className="rounded-xl px-4 py-2 text-sm text-ink-300 transition hover:text-white">取消</button>
              <button onClick={save} disabled={!contents || busy}
                      className="rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-400 disabled:opacity-50">保存…</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
