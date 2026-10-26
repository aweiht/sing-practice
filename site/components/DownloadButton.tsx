import { INSTALLER_URL } from "@/lib/site";

/** Apple Silicon 的未公证预览安装包。 */
export function DownloadButton({ className, note = true }: { className: string; note?: boolean; where?: string }) {
  return (
    <span className="inline-grid gap-1.5">
      <a href={INSTALLER_URL} className={className}>下载 Mac 预览版</a>
      {note && <span className="text-xs text-muted">Apple 芯片 · macOS 14.2+ · 未经 Apple 公证</span>}
    </span>
  );
}
