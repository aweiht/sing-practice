/** 当前没有中文版发布安装包；引导访问源码构建说明。 */
export function DownloadButton({ className, note = true }: { className: string; note?: boolean; where?: string }) {
  return (
    <span className="inline-grid gap-1.5">
      <a href="/docs/" className={className}>查看源码与构建指南</a>
      {note && <span className="text-xs text-muted">目前尚无中文版发布安装包，可从源码自行构建。</span>}
    </span>
  );
}
