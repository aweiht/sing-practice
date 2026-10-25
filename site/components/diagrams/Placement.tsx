"use client";
import { Frame } from "@/components/explain/Frame";
import { ease, seeded, useClock } from "@/components/explain/motion";

export const PLACE_STEPS = [
  "已学习的歌曲会保存声音指纹",
  "将正在播放的几秒声音与指纹匹配",
  "匹配位置就是当前播放进度",
  "跳转歌曲后重新定位",
  "新歌 Shazam 识别能力尚未验证",
];

const COLS = 48, BANDS = 8, CX = 24, CW = 9, BY = 70, BH = 15;
const rnd = seeded(42);
const PRINT = Array.from({ length: COLS }, () => Array.from({ length: BANDS }, () => rnd()));
const TRUE_AT = 14, SKIP_AT = 33, WIN = 6;

/** Fingerprint placement: a short window of the live sound slides along the learned song's fingerprint until it fits. */
export function Placement({ step = 2 }: { step?: number }) {
  const t = useClock(`place-${step}`, 4);
  const target = step >= 3 ? SKIP_AT : TRUE_AT;
  // the window searches from the start (or from where it was before the skip) and settles on the match
  const from = step === 3 ? TRUE_AT : 0;
  const k = step === 1 || step === 3 ? ease(t, 0.2, 2.2) : step >= 2 ? 1 : 0;
  const at = from + (target - from) * k;
  const locked = (step === 2 || step === 4) || (step === 3 && k >= 1);
  const winX = CX + at * CW;
  return (
    <Frame label="随声练如何定位歌曲进度" caption={PLACE_STEPS[step]}>
      <text x={CX} y="56" fontSize="11.5" fill="var(--music)">已学习歌曲的声音指纹（8 个频段，每 10 毫秒）</text>
      {PRINT.map((col, c) => col.map((v, b) => (
        <rect key={`${c}-${b}`} x={CX + c * CW} y={BY + b * BH} width={CW - 1.5} height={BH - 2} rx="1.5" fill="var(--music)" opacity={0.12 + v * 0.75} />
      )))}
      {step >= 1 && (
        <g className="hl">
          <rect x={winX - 2} y={BY - 6} width={WIN * CW + 2.5} height={BANDS * BH + 10} rx="6" fill="none"
            stroke={locked ? "var(--you)" : "var(--fg)"} strokeWidth={locked ? 2.5 : 1.5} strokeDasharray={locked ? undefined : "4 3"} />
          <text x={winX + (WIN * CW) / 2} y={BY + BANDS * BH + 22} textAnchor="middle" fontSize="11" fill={locked ? "var(--you)" : "var(--muted)"}>
            {locked ? "已匹配" : "当前播放声音"}
          </text>
        </g>
      )}
      {step >= 3 && <path d={`M${CX + TRUE_AT * CW + 20} 62 C ${CX + 24 * CW} 40, ${CX + 28 * CW} 40, ${CX + SKIP_AT * CW + 20} 62`} fill="none" stroke="var(--faint)" strokeDasharray="3 3" markerEnd="url(#arr)" />}
      {step === 3 && <text x={CX + 24 * CW} y="40" textAnchor="middle" fontSize="10.5" fill="var(--faint)">跳转位置</text>}
      <defs><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="var(--faint)" /></marker></defs>
      {step === 4 && (
        <g>
          <rect x="120" y="218" width="240" height="40" rx="12" fill="var(--panel)" stroke="var(--music)" />
          <text x="240" y="236" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--fg)">Shazam 新歌识别尚未验证</text>
          <text x="240" y="251" textAnchor="middle" fontSize="10.5" fill="var(--muted)">项目未配置自有开发者标识</text>
        </g>
      )}
    </Frame>
  );
}
