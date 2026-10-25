"use client";
import { Flow, Frame } from "@/components/explain/Frame";
import { useClock } from "@/components/explain/motion";

export const PRIVACY_STEPS = [
  "保存在 Mac 上：歌曲音符与练习录音",
  "不会保存或发送：正在播放的音乐音频",
  "查询歌词和封面：发送歌曲名称等信息",
  "Shazam 识别能力未验证；识别时会发送音乐指纹",
];

const KEPT = ["歌曲音符与音符条", "声音指纹与识别信息", "歌词及时间信息", "练习录音、评分与报告"];

/** A box outside the Mac: what it is, and what's sent to it (one line each). */
function Service({ y, h, title, lines, colour, on, dashed }: {
  y: number; h: number; title: string; lines: string[]; colour: string; on: boolean; dashed?: boolean;
}) {
  return (
    <g className="hl" opacity={on ? 1 : 0.35}>
      <rect x="318" y={y} width="148" height={h} rx="12" fill="var(--panel)" stroke={colour} strokeDasharray={dashed ? "5 3" : undefined} />
      <text x="392" y={y + 20} textAnchor="middle" fontSize="12.5" fontWeight="600" fill="var(--fg)">{title}</text>
      {lines.map((l, i) => (
        <text key={l} x="392" y={y + 37 + i * 15} textAnchor="middle" fontSize="10.5" fill="var(--muted)">{l}</text>
      ))}
    </g>
  );
}

/** What stays on the Mac, what's never kept, and the lookups that leave it. */
export function Privacy({ step = 3, all = false }: { step?: number; all?: boolean }) {
  const t = useClock("privacy", 3);
  const on = (i: number) => all || i === step;
  return (
    <Frame label="随声练保存与发送的数据" caption={all ? "播放中的音乐只分析，不保存" : PRIVACY_STEPS[step]}>
      <rect x="20" y="28" width="250" height="236" rx="16" fill="var(--panel)" stroke="var(--line)" />
      <text x="36" y="50" fontSize="12" fontWeight="600" fill="var(--fg)">你的 Mac</text>
      <g className="hl" opacity={on(0) ? 1 : 0.35}>
        {KEPT.map((s, i) => (
          <g key={s} transform={`translate(32 ${66 + i * 30})`}>
            <rect width="226" height="24" rx="7" fill="var(--bg-raised)" stroke={i === 3 ? "var(--you)" : "var(--singer)"} strokeOpacity="0.7" />
            <text x="9" y="16" fontSize="11.5" fill="var(--fg-soft)">{s}</text>
          </g>
        ))}
      </g>
      <g className="hl" opacity={on(1) ? 1 : 0.35} transform="translate(32 196)">
        <rect width="226" height="44" rx="8" fill="none" stroke="var(--off)" strokeDasharray="4 3" />
        <text x="9" y="18" fontSize="11.5" fill="var(--fg-soft)">播放中的音乐：边播放边分析</text>
        <text x="9" y="34" fontSize="11.5" fill="var(--fg-soft)">不会保存或发送</text>
      </g>
      <Flow d="M270 61 H318" colour="var(--singer)" t={t} on={on(2)} />
      <Flow d="M270 128 H318" colour="var(--singer)" t={t} on={on(2)} />
      <Flow d="M270 208 H318" colour="var(--music)" t={t} on={on(3)} />
      <Service y={30} h={62} title="LRCLIB" lines={["歌名、歌手、专辑", "和时长：查询歌词"]} colour="var(--singer)" on={on(2)} />
      <Service y={102} h={52} title="iTunes Search" lines={["歌手、歌名：查询封面"]} colour="var(--singer)" on={on(2)} />
      <Service y={166} h={84} title="ShazamKit" lines={["新歌识别尚未验证", "可能发送音乐指纹", "不含麦克风录音"]} colour="var(--music)" on={on(3)} dashed />
    </Frame>
  );
}
