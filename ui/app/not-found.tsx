import Link from "next/link";
import { Logo, Nav } from "@/components/Nav";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      <header data-tauri-drag-region className="app-header flex items-center gap-5 px-6 pt-4 pb-3"><Logo /><Nav /></header>
      <main className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-6 pb-16 text-center">
        <div>
          <p className="text-sm font-medium text-accent-300">404</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">找不到此页面</h1>
          <p className="mt-2 text-ink-300">链接可能已更改，或地址输入有误。</p>
          <Link href="/" className="mt-6 inline-block rounded-xl bg-accent-500 px-4 py-2 font-medium text-white transition hover:bg-accent-400">返回练习</Link>
        </div>
      </main>
    </div>
  );
}
