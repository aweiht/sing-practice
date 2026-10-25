import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto grid max-w-3xl justify-items-center gap-4 px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-medium text-accent-soft">错误代码 404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-fg">找不到这个页面</h1>
      <p className="max-w-xl leading-relaxed text-muted">链接可能已失效，或网址输入有误。你可以返回首页，或查看源码构建指南。</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-xl bg-accent px-5 py-3 font-medium text-white hover:bg-accent-strong">返回首页</Link>
        <Link href="/docs/" className="rounded-xl border border-line px-5 py-3 font-medium text-fg hover:bg-panel">查看构建指南</Link>
      </div>
    </section>
  );
}
