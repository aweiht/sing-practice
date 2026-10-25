/** The four colours every diagram uses, each with one meaning. */
const ROLES = [
  { c: "var(--music)", name: "伴奏", note: "播放器正在播放的音乐" },
  { c: "var(--singer)", name: "原唱", note: "原唱人声、音符与歌词" },
  { c: "var(--you)", name: "你的声音", note: "麦克风采集的演唱" },
  { c: "var(--score)", name: "练习评分", note: "你的音高与目标音的接近程度" },
];

export function Legend({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`wide not-prose !mt-6 flex list-none flex-wrap gap-x-5 gap-y-2 !pl-0 text-[13px] ${compact ? "" : "rounded-xl border border-line bg-bg-raised px-4 py-3"}`} aria-label="图解中的颜色含义">
      {ROLES.map((r) => (
        <li key={r.name} className="!mt-0 flex items-center gap-2 text-muted">
          <span className="inline-block h-2.5 w-5 rounded-full" style={{ background: r.c }} aria-hidden="true" />
          <span><strong className="font-medium text-fg">{r.name}</strong>{compact ? "" : <span className="hidden sm:inline">: {r.note}</span>}</span>
        </li>
      ))}
    </ul>
  );
}
