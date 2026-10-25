import Link from "next/link";
import { LogoMark } from "./Logo";
import { GITHUB_URL, NOT_AFFILIATED } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-[1fr_auto]">
        <div className="grid max-w-xl gap-3">
          <div className="flex items-center gap-2.5 text-fg">
            <LogoMark size={24} />
            <span className="font-semibold tracking-tight">随声练</span>
            <span className="text-muted">· MIT 开源软件</span>
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            改编自 <a href="https://github.com/dsmurrell/onkey" className="text-fg underline-offset-2 hover:underline">Daniel Murrell 的 OnKey</a>，遵循 MIT 许可证
          </p>
          <p className="text-xs leading-relaxed text-faint">{NOT_AFFILIATED}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="页脚导航">
          <Link href="/docs/" className="inline-block py-1.5 hover:text-fg">构建指南</Link>
          <Link href="/docs/how-it-works/" className="inline-block py-1.5 hover:text-fg">工作原理</Link>
          <Link href="/docs/privacy/" className="inline-block py-1.5 hover:text-fg">隐私与法律</Link>
          <Link href="/docs/faq/" className="inline-block py-1.5 hover:text-fg">常见问题</Link>
          <a href={GITHUB_URL} className="inline-block py-1.5 hover:text-fg">源码仓库</a>
        </nav>
      </div>
    </footer>
  );
}
