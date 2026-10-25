"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const DOCS = [
  { href: "/docs/", title: "源码构建" },
  { href: "/docs/how-it-works/", title: "工作原理" },
  { href: "/docs/scoring/", title: "评分说明" },
  { href: "/docs/privacy/", title: "隐私与法律" },
  { href: "/docs/faq/", title: "常见问题" },
  { href: "/docs/your-voice/", title: "舒适演唱" },
  { href: "/docs/troubleshooting/", title: "故障排查" },
  { href: "/docs/credits/", title: "致谢与许可" },
];

export function DocsNav() {
  const path = usePathname();
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  return (
    <nav aria-label="文档导航" className="flex flex-wrap gap-1 border-b border-line pb-4 text-sm md:grid md:gap-0.5 md:border-0 md:pb-0">
      <p className="mb-2 hidden px-3 text-xs font-medium uppercase tracking-wider text-faint md:block">文档</p>
      {DOCS.map((d) => {
        const on = norm(path) === d.href;
        return (
          <Link
            key={d.href}
            href={d.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-lg border border-line px-3 py-2.5 transition md:border-0 md:py-1.5 ${on ? "bg-accent-wash font-medium text-fg" : "text-muted hover:bg-panel hover:text-fg"}`}
          >
            {d.title}
          </Link>
        );
      })}
    </nav>
  );
}
