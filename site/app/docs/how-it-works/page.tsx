import type { Metadata } from "next";
import { Legend } from "@/components/explain/Legend";
import { HowSections } from "@/components/docs/HowSections";

export const metadata: Metadata = { title: "工作原理" };

export default function HowItWorks() {
  return (
    <>
      <h1>工作原理</h1>
      <p className="lede">
        从整体流程到算法参数，分为七个部分。应用在本机分析歌曲，不会保存正在播放的音乐。
      </p>
      <p className="callout">详细实现与测量数据沿用 OnKey 上游版本，尚未针对随声练改版或中文歌曲独立复测。Shazam 新歌识别能力未验证，中文歌词对齐也未验证。</p>
      <Legend />
      <HowSections />
    </>
  );
}
