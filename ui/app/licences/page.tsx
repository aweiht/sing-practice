"use client";
// Open-source licences: THIRD_PARTY_NOTICES.md as shipped inside the app (the models, data, fonts and libraries
// OnKey uses, with the copyright notices and licence texts their licences ask to go with every copy).
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, Nav } from "@/components/Nav";
import { thirdPartyNotices } from "@/lib/session";

export default function LicencesPage() {
  const [text, setText] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { thirdPartyNotices().then(setText).catch(() => setError("无法读取许可证声明，请稍后重试。")); }, []);

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      <header data-tauri-drag-region className="app-header flex items-center gap-5 px-6 pt-4 pb-3"><Logo /><Nav /></header>
      <main className="mx-auto max-w-3xl px-6 pb-16">
        <Link href="/settings" className="mt-6 inline-block text-xs text-ink-400 hover:text-white">← 设置</Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">开源许可证</h1>
        <p className="mt-2 text-sm text-ink-400">随声练使用 MIT 许可证开源。应用也基于以下模型、数据、字体和软件库构建。</p>
        {error ? <p className="glass mt-6 rounded-3xl p-5 text-sm text-amber-200">无法读取许可证声明：{error}</p>
          : text === undefined ? <div className="glass mt-6 h-40 rounded-3xl shimmer" />
          : text === null ? <p className="glass mt-6 rounded-3xl p-5 text-sm text-ink-300">第三方许可证声明位于源码目录中的 THIRD_PARTY_NOTICES.md。</p>
          : <pre className="glass mt-6 overflow-x-auto whitespace-pre-wrap break-words rounded-3xl p-5 font-mono text-[11px] leading-relaxed text-ink-200 select-text">{text}</pre>}
      </main>
    </div>
  );
}
