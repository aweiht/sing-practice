"use client";
import { Flow, Frame, Node, wavePath } from "@/components/explain/Frame";
import { useClock } from "@/components/explain/motion";
import { waveform } from "./song";

export const HEAR_STEPS = [
  "Mac 上的多个应用都可能发出声音",
  "只采集音乐播放器的声音",
  "麦克风与音乐使用同一时钟",
  "播放时分析，不保存音乐",
];

const MUSIC = waveform(70, "mix", 3);
const VOICE = waveform(70, "vocal", 9);

/** Per-app capture: only the music app is heard, your mic shares its clock, and nothing is written to disk. */
export function Hearing({ step = 3 }: { step?: number }) {
  const t = useClock(`hear-${step}`, 3);
  const scroll = (t * 26) % 40;
  return (
    <Frame label="随声练如何采集声音" caption={HEAR_STEPS[step]}>
      <Node x={78} y={56} w={120} h={40} colour="var(--music)" title="音乐播放器" on />
      <Node x={78} y={110} w={120} h={40} colour="var(--line)" title="浏览器" on={step === 0} />
      <Node x={78} y={164} w={120} h={40} colour="var(--line)" title="消息应用" on={step === 0} />
      <Node x={78} y={226} w={120} h={40} colour="var(--you)" title="麦克风" on={step >= 2} />
      <Flow d="M140 56 C190 56 200 110 240 110" colour="var(--music)" t={t} on={step >= 1} />
      <Flow d="M140 226 C190 226 200 150 240 150" colour="var(--you)" t={t} on={step >= 2} />
      <g className="hl" opacity={step === 0 ? 0.3 : 1}>
        <rect x="240" y="86" width="200" height="88" rx="14" fill="var(--panel)" stroke="var(--accent)" />
        <text x="252" y="104" fontSize="12" fontWeight="600" fill="var(--fg)">随声练</text>
        <clipPath id="hear-clip"><rect x="250" y="110" width="180" height="56" /></clipPath>
        <g clipPath="url(#hear-clip)">
          <path d={wavePath(MUSIC, 250 - scroll, 124, 220, 11)} fill="none" stroke="var(--music)" strokeWidth="1.3" />
          {step >= 2 && <path d={wavePath(VOICE, 250 - scroll, 152, 220, 9)} fill="none" stroke="var(--you)" strokeWidth="1.3" />}
          {step >= 2 && [0, 1, 2, 3, 4, 5].map((k) => (
            <line key={k} x1={260 + k * 40 - scroll} x2={260 + k * 40 - scroll} y1="112" y2="164" stroke="var(--fg)" strokeOpacity="0.18" strokeDasharray="2 3" />
          ))}
        </g>
        {step >= 2 && <text x="430" y="104" textAnchor="end" fontSize="10.5" fill="var(--muted)">同一时钟</text>}
      </g>
      <g className="hl" opacity={step >= 3 ? 1 : 0.2} transform="translate(340 200)">
        <rect x="-26" y="0" width="52" height="40" rx="6" fill="var(--panel)" stroke="var(--line)" />
        <text x="0" y="25" textAnchor="middle" fontSize="11" fill="var(--muted)">磁盘</text>
        <line x1="-34" y1="-4" x2="34" y2="44" stroke="var(--off)" strokeWidth="2.5" strokeLinecap="round" />
        <text x="44" y="24" fontSize="11.5" fill="var(--fg-soft)">不保存音乐</text>
      </g>
      {step === 1 && <text x="140" y="128" fontSize="10.5" fill="var(--faint)">不会采集</text>}
    </Frame>
  );
}
