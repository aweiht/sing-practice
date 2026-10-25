"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Logo() {
  const path = usePathname();
  // on Sing already, the logo opens the songs to try over the page (StarterSheet) instead of going nowhere
  const onClick = (e: React.MouseEvent) => {
    if (path === "/") { e.preventDefault(); window.dispatchEvent(new CustomEvent("onkey-songs-to-try")); }
  };
  return (
    <Link href="/" onClick={onClick} title={path === "/" ? "试试这些歌曲" : "开始练习"} className="flex items-center gap-2.5 rounded-xl transition hover:opacity-80">
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 shadow-lg shadow-accent-600/30">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M3 14c2.5 0 2.5-6 5-6s2.5 8 5 8 2.5-10 5-10 2 4 3 4" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">随声练</span>
    </Link>
  );
}

export function Nav() {
  const path = usePathname();
  const item = (href: string, label: string) => {
    const on = href === "/" ? path === "/" : path.startsWith(href);
    return (
      <Link href={href} className={`rounded-full px-3 py-1.5 text-sm transition ${on ? "bg-white/8 text-white" : "text-ink-300 hover:text-white"}`}>
        {label}
      </Link>
    );
  };
  return <nav aria-label="主导航" className="flex items-center gap-1">{item("/", "练习")}{item("/library", "曲库")}{item("/history", "演唱记录")}{item("/settings", "设置")}</nav>;
}
