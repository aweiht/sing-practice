"use client";
import { useId, useRef, useState } from "react";
import { Frame } from "@/components/explain/Frame";
import { ease, useClock } from "@/components/explain/motion";
import { DUR, PHRASE, singerPitch, yourPitch } from "./song";

/** Pitch credit, exactly as OnKey scores it (dsp.rs `credit`): full within 50 cents, none from 150 cents. */
export const credit = (cents: number) => Math.min(1, Math.max(0, (150 - Math.abs(cents)) / 100));
/** Octaves forgiven: the error is folded into ±600 cents (dsp.rs `fold`). */
export const fold = (c: number) => ((((c + 600) % 1200) + 1200) % 1200) - 600;
/** How much of the singer's part you sang scales the score (dsp.rs `score`): full from 40% sung. */
export const coverageFactor = (c: number, full = 0.4) => 0.3 * Math.min(1, c / 0.1) + 0.7 * Math.min(1, c / full);
const grade = (cents: number) => (Math.abs(cents) <= 50 ? "var(--good)" : Math.abs(cents) <= 100 ? "var(--close)" : "var(--off)");

export const SCORE_STEPS = [
  "每 10 毫秒将你的音高与原唱比较",
  "音高误差在半个半音内可得满分",
  "高低八度会折算为同一个音",
  "轻微早唱或晚唱不会直接扣分",
  "音符保持半段时长即可计为命中",
  "总分由音准与演唱覆盖比例共同决定",
];

const X0 = 34, XW = 412, ROW = 17, BASE = 226;
const x = (t: number) => X0 + (t / DUR) * XW;
const y = (n: number) => BASE - (n + 0.5) * ROW;

/** The phrase from the learning diagram, now sung by you: each step lights up one scoring rule. */
export function ScoreDiagram({ step = 5 }: { step?: number }) {
  const t = useClock(`score-${step}`, 3);
  const oct = step === 2 ? 12 * ease(t, 0.4, 0.9) * (1 - ease(t, 2.4, 0.9)) : 0;
  const late = step === 3 ? 0.12 * Math.sin(Math.min(t, 3) * 2) : 0;
  const seg: React.ReactNode[] = [];
  for (let s = 0; s < DUR; s += 0.02) {
    const a = yourPitch(s + late), b = yourPitch(s + 0.02 + late), ref = singerPitch(s);
    if ([a, b, ref].some(Number.isNaN)) continue;
    const err = fold((a - ref) * 100);
    seg.push(<line key={s} x1={x(s)} y1={y(a - oct)} x2={x(s + 0.02)} y2={y(b - oct)} stroke={step === 0 ? "var(--you)" : grade(err)} strokeWidth="3" strokeLinecap="round" />);
  }
  const hitNotes = [true, true, false, true, true, true, true];
  const acc = 0.86, sang = 0.8, score = Math.round(100 * acc * coverageFactor(sang));
  return (
    <Frame label="随声练如何计算演唱评分" caption={SCORE_STEPS[step]}>
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={X0} y={BASE - (i + 1) * ROW} width={XW} height={ROW} fill={i % 2 ? "var(--panel)" : "transparent"} opacity="0.6" />
      ))}
      {PHRASE.map(([s, e, n, w], i) => (
        <g key={i}>
          <rect x={x(s)} y={y(n) - ROW * 0.36} width={x(e) - x(s)} height={ROW * 0.72} rx={ROW * 0.36}
            fill={step === 4 ? (hitNotes[i] ? "var(--good)" : "var(--off)") : "var(--singer)"} fillOpacity={step === 4 ? 0.55 : 0.35} />
          <text x={(x(s) + x(e)) / 2} y={y(n) + 22} textAnchor="middle" fontSize="11" fill="var(--faint)">{w}</text>
        </g>
      ))}
      {seg}
      {step === 1 && (
        <g>
          <rect x={x(0.9)} y={y(7) - ROW * 1.5} width={x(1.5) - x(0.9)} height={ROW * 3} fill="none" stroke="var(--close)" strokeDasharray="3 3" />
          <text x={x(1.2)} y={y(7) - ROW * 1.8} textAnchor="middle" fontSize="11" fill="var(--close)">偏低 60 音分：得分 90%</text>
        </g>
      )}
      {step === 2 && <text x={X0 + XW} y="40" textAnchor="end" fontSize="11" fill="var(--good)">低一个八度仍可命中</text>}
      {step === 3 && <text x={x(2.2)} y={y(4) - 26} textAnchor="middle" fontSize="11" fill="var(--good)">允许 ±80 毫秒时差</text>}
      {step === 5 && (
        <g>
          <rect x="300" y="28" width="160" height="58" rx="12" fill="var(--panel)" stroke="var(--score)" />
          <text x="380" y="62" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--score)">{score}</text>
          <text x="380" y="78" textAnchor="middle" fontSize="10.5" fill="var(--muted)">音准 86% · 演唱覆盖 80%</text>
        </g>
      )}
    </Frame>
  );
}

/** 可拖动音高曲线，也可使用下方滑块查看对应得分。 */
export function CreditPlayground() {
  const [cents, setCents] = useState(60);
  const [octave, setOctave] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const id = useId();
  const shown = cents + (octave ? -1200 : 0);
  const c = credit(fold(shown));
  const CW = 480, CH = 220, cx = (v: number) => 40 + ((v + 300) / 600) * 400, cy = (v: number) => 180 - v * 140;
  const drag = (e: React.PointerEvent) => {
    if (!(e.buttons & 1) || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    const v = ((e.clientX - r.left) / r.width * CW - 40) / 400 * 600 - 300;
    setCents(Math.round(Math.max(-300, Math.min(300, v)) / 5) * 5);
  };
  const curve = Array.from({ length: 121 }, (_, i) => -300 + i * 5).map((v, i) => `${i ? "L" : "M"}${cx(v)},${cy(credit(v))}`).join(" ");
  return (
    <div className="wide rounded-2xl border border-line bg-bg-raised px-2 py-4 sm:p-4">
      <p className="!mt-0 text-sm font-medium text-fg">试一试：音高偏差如何影响得分？</p>
      <svg ref={svg} viewBox={`0 0 ${CW} ${CH}`} className="dg mt-2 block h-auto w-full touch-none select-none" onPointerDown={drag} onPointerMove={drag}
        role="img" aria-label={`评分曲线：当前音高${cents === 0 ? "准确" : `偏${cents < 0 ? "低" : "高"} ${Math.abs(cents)} 音分`}，得分 ${Math.round(c * 100)}%。`}>
        <rect x="40" y="40" width="400" height="140" fill="var(--panel)" />
        <rect x={cx(-50)} y="40" width={cx(50) - cx(-50)} height="140" fill="var(--good)" opacity="0.12" />
        {[-300, -150, -50, 0, 50, 150, 300].map((v) => (
          <g key={v}>
            <line x1={cx(v)} x2={cx(v)} y1="40" y2="180" stroke="var(--line)" />
            <text x={cx(v)} y="198" textAnchor="middle" fontSize="11" fill="var(--muted)">{v > 0 ? `+${v}` : v}</text>
          </g>
        ))}
        <text x="240" y="216" textAnchor="middle" fontSize="11" fill="var(--faint)">与目标音的偏差（100 音分 = 1 个半音）</text>
        <text x="34" y="44" textAnchor="end" fontSize="11" fill="var(--muted)">100%</text>
        <text x="34" y="184" textAnchor="end" fontSize="11" fill="var(--muted)">0</text>
        <path d={curve} fill="none" stroke="var(--score)" strokeWidth="2.5" />
        <line x1={cx(cents)} x2={cx(cents)} y1="30" y2="180" stroke={grade(fold(shown))} strokeWidth="2" />
        <circle cx={cx(cents)} cy={cy(c)} r="9" fill={grade(fold(shown))} stroke="var(--bg-raised)" strokeWidth="3" style={{ cursor: "ew-resize" }} />
        <text x={cx(cents)} y="22" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--fg)">得分 {Math.round(c * 100)}%</text>
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        <label htmlFor={`${id}-c`} className="flex items-center gap-3">
          当前音高
          <input id={`${id}-c`} type="range" min={-300} max={300} step={5} value={cents} onChange={(e) => setCents(Number(e.target.value))} className="w-40 accent-[var(--accent)]" />
          <span className="tabular w-24 text-fg">{cents === 0 ? "音高准确" : `${Math.abs(cents)} 音分偏${cents < 0 ? "低" : "高"}`}</span>
        </label>
        <label htmlFor={`${id}-o`} className="flex items-center gap-2">
          <input id={`${id}-o`} type="checkbox" checked={octave} onChange={(e) => setOctave(e.target.checked)} className="accent-[var(--accent)]" />
          低一个八度演唱
        </label>
      </div>
    </div>
  );
}

/** 拖动演唱覆盖比例，查看音准为 86% 时的总分变化。 */
export function CoveragePlayground() {
  const [sang, setSang] = useState(0.5);
  const id = useId();
  const acc = 0.86;
  const cx = (v: number) => 40 + v * 400, cy = (v: number) => 170 - v * 130;
  const line = (full: number) => Array.from({ length: 101 }, (_, i) => i / 100).map((v, i) => `${i ? "L" : "M"}${cx(v)},${cy(coverageFactor(v, full))}`).join(" ");
  return (
    <div className="wide rounded-2xl border border-line bg-bg-raised px-2 py-4 sm:p-4">
      <p className="!mt-0 text-sm font-medium text-fg">试一试：演唱多少比例会影响总分？</p>
      <svg viewBox="0 0 480 210" className="dg mt-2 block h-auto w-full" role="img" aria-label={`音准 86%、演唱覆盖 ${Math.round(sang * 100)}% 时，总分为 ${Math.round(100 * acc * coverageFactor(sang))} 分。`}>
        <rect x="40" y="40" width="400" height="130" fill="var(--panel)" />
        {[0, 0.1, 0.25, 0.4, 0.6, 0.8, 1].map((v) => (
          <g key={v}>
            <line x1={cx(v)} x2={cx(v)} y1="40" y2="170" stroke="var(--line)" />
            <text x={cx(v)} y="188" textAnchor="middle" fontSize="11" fill="var(--muted)">{Math.round(v * 100)}%</text>
          </g>
        ))}
        <text x="240" y="205" textAnchor="middle" fontSize="11" fill="var(--faint)">你演唱的原唱部分比例</text>
        <path d={line(0.4)} fill="none" stroke="var(--score)" strokeWidth="2.5" />
        <circle cx={cx(sang)} cy={cy(coverageFactor(sang))} r="8" fill="var(--score)" stroke="var(--bg-raised)" strokeWidth="3" />
        <text x="440" y="30" textAnchor="end" fontSize="13" fontWeight="600" fill="var(--fg)">音准 86% 时得 {Math.round(100 * acc * coverageFactor(sang))} 分</text>
      </svg>
      <label htmlFor={`${id}-s`} className="mt-3 flex items-center gap-3 text-sm text-muted">
        演唱覆盖
        <input id={`${id}-s`} type="range" min={0} max={1} step={0.01} value={sang} onChange={(e) => setSang(Number(e.target.value))} className="w-48 accent-[var(--accent)]" />
        <span className="tabular text-fg">{Math.round(sang * 100)}%</span>
      </label>
    </div>
  );
}
