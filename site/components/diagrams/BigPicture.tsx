"use client";
import { Flow, Frame, Node } from "@/components/explain/Frame";
import { useClock } from "@/components/explain/motion";

export const BIG_STEPS = [
  "音乐播放器开始播放",
  "随声练在本机分析",
  "首次播放时学习旋律",
  "跟着音符参考演唱",
  "查看评分与练习报告",
];

/** 整个练习流程；`step` 表示当前高亮的阶段。 */
export function BigPicture({ step = 4, all = false }: { step?: number; all?: boolean }) {
  const t = useClock("big", 3);
  const on = (i: number) => all || i === step;
  const reached = (i: number) => all || i <= step;
  return (
    <Frame label="随声练的完整工作流程" caption={all ? "从音乐播放到练习评分，都在本机完成。" : BIG_STEPS[step]}>
      <rect x="196" y="22" width="268" height="100" rx="16" fill="none" stroke="var(--line)" strokeDasharray="4 4" />
      <text x="452" y="38" textAnchor="end" fontSize="11" fill="var(--faint)">随声练 · 本机处理</text>
      <Flow d="M126 80 H186" colour="var(--music)" t={t} on={reached(1)} />
      <Flow d="M296 80 H340" colour="var(--music)" t={t} on={reached(2)} />
      <Flow d="M402 108 C402 150 380 176 352 196" colour="var(--singer)" t={t} on={reached(3)} />
      <Flow d="M278 222 H206" colour="var(--you)" t={t} on={reached(4)} />
      <Node x={70} y={80} w={110} colour="var(--music)" title="音乐播放器" sub="Spotify 等" on={on(0)} />
      <Node x={241} y={80} w={98} colour="var(--music)" title="分析声音" sub="不保存音乐" on={on(1)} />
      <Node x={402} y={80} w={112} colour="var(--singer)" title="学习旋律" sub="音符与歌词" on={on(2)} />
      <Node x={340} y={222} w={124} colour="var(--you)" title="跟着演唱" sub="采集你的声音" on={on(3)} />
      <Node x={140} y={222} w={124} colour="var(--score)" title="练习评分" sub="附音符报告" on={on(4)} />
    </Frame>
  );
}
