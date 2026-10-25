"use client";
// Score per take over time: a line with a dot per take, a hover tooltip, a faint 0-100 grid.
import { useEffect, useRef, useState } from "react";
import type { TakeSummary } from "@/lib/session";
import { when } from "@/lib/music";

const TREND = "#8a78ff";   // validated for the dark surface (dataviz lightness/contrast checks)

export default function Trend({ takes }: { takes: TakeSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const H = 220, P = { l: 34, r: 12, t: 12, b: 26 };
  const n = takes.length;
  const x = (i: number) => P.l + (n <= 1 ? (w - P.l - P.r) / 2 : (i / (n - 1)) * (w - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const path = takes.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(t.score).toFixed(1)}`).join(" ");
  const hv = hover != null ? takes[hover] : null;
  return (
    <div ref={ref} className="relative">
      <svg width={w} height={H} className="block" role="img" aria-label={`练习得分趋势，共 ${n} 次记录`}
           onMouseMove={e => {
             const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
             const i = Math.round(((e.clientX - r.left - P.l) / (w - P.l - P.r)) * (n - 1));
             setHover(Math.max(0, Math.min(n - 1, i)));
           }}
           onMouseLeave={() => setHover(null)}>
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={P.l} x2={w - P.r} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.06)" />
            <text x={P.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="fill-ink-400 text-[10px]">{v}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={TREND} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {takes.map((t, i) => (
          <circle key={t.id} cx={x(i)} cy={y(t.score)} r={hover === i ? 5.5 : 4} fill={TREND} stroke="#10131b" strokeWidth={2} />
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(255,255,255,.18)" />}
      </svg>
      {hv && (
        <div className="pointer-events-none absolute top-2 rounded-xl border border-white/10 bg-ink-800/95 px-3 py-2 text-xs shadow-xl"
             style={{ left: Math.min(Math.max(0, x(hover!) - 90), w - 190), width: 180 }}>
          <div className="truncate font-medium text-ink-100">{hv.track.name}</div>
          <div className="text-ink-400">{when(hv.recorded)}</div>
          <div className="mt-1 text-ink-200">得分 <span className="tabular font-semibold text-white">{hv.score}</span>
            {hv.notes_total ? <> · 命中 {hv.notes_hit}/{hv.notes_total} 个音符</> : null}</div>
        </div>
      )}
    </div>
  );
}

