"use client";
import { Frame, wavePath } from "@/components/explain/Frame";
import { ease, useClock } from "@/components/explain/motion";
import { waveform } from "./song";

export const ECHO_STEPS = [
  "不戴耳机时，麦克风会同时收到人声与伴奏",
  "随声练能同步分析播放器的声音",
  "应用会学习声音如何传到麦克风",
  "估算并消除伴奏，保留你的声音",
  "戴耳机时，麦克风几乎收不到伴奏",
];

const N = 90;
const SONG = waveform(N, "mix", 21), YOU = waveform(N, "vocal", 23);
const MIXED = SONG.map((v, i) => 0.55 * v + 0.6 * YOU[i]);

/** 回声消除示意：麦克风会收到演唱和扬声器中的音乐，应用尝试消除伴奏。 */
export function Echo({ step = 3 }: { step?: number }) {
  const t = useClock(`echo-${step}`, 3);
  const k = step === 3 ? ease(t, 0.3, 1.4) : step > 3 ? 1 : 0;
  const mic = step === 4 ? YOU.map((v) => 0.6 * v) : MIXED.map((v, i) => v - 0.55 * SONG[i] * k);
  const pulse = (t * 1.2) % 1;
  return (
    <Frame label="回声消除原理" caption={ECHO_STEPS[step]}>
      {/* speaker sending sound towards the mic */}
      <g className="hl" opacity={step === 4 ? 0.25 : 1}>
        <rect x="28" y="54" width="34" height="46" rx="6" fill="var(--panel)" stroke="var(--music)" />
        <circle cx="45" cy="77" r="10" fill="none" stroke="var(--music)" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${74 + i * 16 + pulse * 16} 62 q8 15 0 30`} fill="none" stroke="var(--music)" strokeWidth="1.6" opacity={step === 4 ? 0 : 1 - (i + pulse) / 3} />
        ))}
        <text x="45" y="118" textAnchor="middle" fontSize="11" fill="var(--music)">扬声器</text>
      </g>
      {step === 4 && <text x="45" y="140" textAnchor="middle" fontSize="11" fill="var(--fg-soft)">耳机</text>}
      <g>
        <rect x="150" y="60" width="18" height="30" rx="9" fill="var(--panel)" stroke="var(--you)" />
        <text x="159" y="118" textAnchor="middle" fontSize="11" fill="var(--you)">麦克风</text>
      </g>
      {/* what the mic hears, before and after */}
      <text x="200" y="56" fontSize="11.5" fill="var(--muted)">{step >= 3 ? "消除后剩下的声音" : "麦克风收到的声音"}</text>
      <path d={wavePath(mic, 200, 82, 250, 26)} fill="none" stroke={step >= 3 ? "var(--you)" : "var(--fg-soft)"} strokeWidth="1.3" />
      {/* 播放器声音及其传到麦克风的路径 */}
      <g className="hl" opacity={step >= 1 && step <= 3 ? 1 : 0.15}>
        <text x="200" y="152" fontSize="11.5" fill="var(--music)">播放声音副本（与麦克风使用同一时钟）</text>
        <path d={wavePath(SONG, 200, 178, 250, 20)} fill="none" stroke="var(--music)" strokeWidth="1.2" />
      </g>
      <g className="hl" opacity={step === 2 || step === 3 ? 1 : 0.15}>
        <text x="200" y="222" fontSize="11.5" fill="var(--muted)">房间造成的延迟、回声和音色变化</text>
        {Array.from({ length: 16 }, (_, i) => (
          <rect key={i} x={200 + i * 15} y={250 - (i === 2 ? 20 : 14 * Math.exp(-i / 4))} width="9" height={i === 2 ? 20 : 14 * Math.exp(-i / 4) + 1} rx="2" fill="var(--music)" opacity="0.7" />
        ))}
      </g>
      {step === 3 && <text x="459" y="118" textAnchor="end" fontSize="12" fontWeight="600" fill="var(--you)">− 伴奏</text>}
    </Frame>
  );
}
