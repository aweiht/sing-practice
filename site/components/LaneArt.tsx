/**
 * 用 SVG 绘制的音符轨道示意：音符向当前进度线移动，演唱音高以绿色、橙色或红色显示，歌词位于下方。
 * 仅作示意，不代表应用中的实际界面。
 */
const BARS: [number, number, number, "hit" | "miss" | "next"][] = [
  // x, width, row (semitones above the lowest row), state
  [18, 54, 6, "hit"], [78, 30, 8, "hit"], [114, 62, 9, "hit"], [182, 40, 6, "miss"],
  [228, 70, 4, "hit"], [304, 36, 6, "next"], [346, 58, 9, "next"], [410, 30, 11, "next"],
  [446, 76, 9, "next"], [528, 44, 6, "next"],
];
// your pitch, in the same units: [x, row]
const TRAIL: [number, number][] = [
  [20, 6.1], [40, 5.9], [70, 6.05], [80, 7.6], [96, 8.05], [112, 8.6], [130, 9.0], [160, 8.95], [174, 9.1],
  [184, 7.2], [196, 6.9], [214, 7.3], [230, 4.5], [250, 4.05], [270, 3.95], [282, 4.1],
];
const ROWS = 14, W = 600, H = 250, top = 18, rowH = (H - 36 - top) / ROWS, NOW = 288;
const y = (row: number) => top + (ROWS - 1 - row) * rowH + rowH / 2;

function trailColour(i: number) {
  const [x, r] = TRAIL[i];
  const bar = BARS.find(([bx, bw]) => x >= bx && x <= bx + bw);
  const err = bar ? Math.abs(r - bar[2]) : 0;
  return err <= 0.5 ? "var(--good)" : err <= 1 ? "var(--close)" : "var(--off)";
}

export function LaneArt() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="音符轨道示意图，展示音符、演唱音高和歌词">
      <rect x="0" y="0" width={W} height={H} fill="var(--bg-raised)" />
      {Array.from({ length: ROWS }, (_, i) => (
        <rect key={i} x="0" y={top + i * rowH} width={W} height={rowH} fill={[1, 3, 6, 8, 10].includes(i % 12) ? "var(--panel)" : "transparent"} opacity="0.7" />
      ))}
      {BARS.map(([x, w, row, s], i) => (
        <rect
          key={i} x={x} y={y(row) - rowH * 0.36} width={w} height={rowH * 0.72} rx={rowH * 0.36}
          fill={s === "hit" ? "var(--good)" : s === "miss" ? "var(--off)" : "var(--accent)"}
          opacity={s === "next" ? 0.85 : 0.32}
        />
      ))}
      {TRAIL.slice(1).map(([x, r], i) => (
        <line key={i} x1={TRAIL[i][0]} y1={y(TRAIL[i][1])} x2={x} y2={y(r)} stroke={trailColour(i + 1)} strokeWidth="3.2" strokeLinecap="round" />
      ))}
      <line x1={NOW} y1={top - 6} x2={NOW} y2={H - 30} stroke="var(--fg)" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx={NOW - 2} cy={y(4.1)} r="7" fill="var(--good)" fillOpacity="0.55" stroke="var(--good)" strokeWidth="1.5" />
      <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="15" fontFamily="var(--font-sans)" fill="var(--muted)">
        <tspan fill="var(--fg)">跟着这一句</tspan> 一起唱
      </text>
    </svg>
  );
}
