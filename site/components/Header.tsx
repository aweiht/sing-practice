import Link from "next/link";
import { Logo } from "./Logo";
import { GITHUB_URL } from "@/lib/site";
import { DownloadButton } from "./DownloadButton";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm" aria-label="主导航">
          <Link href="/docs/" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted transition hover:text-fg">构建指南</Link>
          <Link href="/docs/faq/" className="inline-flex min-h-11 items-center rounded-full px-3 text-muted transition hover:text-fg">常见问题</Link>
          <a href={GITHUB_URL} className="inline-flex min-h-11 items-center rounded-full px-3 text-muted transition hover:text-fg">源码仓库</a>
        </nav>
        <span className="ml-auto hidden sm:inline-block">
          <DownloadButton where="header" note={false} className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong" />
        </span>
      </div>
    </header>
  );
}
