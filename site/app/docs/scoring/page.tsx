import type { Metadata } from "next";
import { CoveragePlayground, CreditPlayground } from "@/components/diagrams/Scoring";

export const metadata: Metadata = { title: "评分说明" };

export default function Scoring() {
  return (
    <>
      <h1>评分说明</h1>
      <p className="lede">这里说明评分字段、音高比较方式和当前已知限制。</p>
      <p className="callout">算法与测量数据来自 OnKey 上游版本的说明和记录；尚未针对随声练改版或中文歌曲独立复测。中文歌词对齐能力也未验证。</p>

      <h2>评分规则</h2>
      <ul>
        <li><strong>每 10 毫秒比较一次。</strong>当你与原唱都在演唱时，应用会比较你的音高与原唱音高、目标音符，按距离更近的一项计算。</li>
        <li><strong>音高误差。</strong>误差在 50 音分（半个半音）以内时得满分；误差到 150 音分时降至零。</li>
        <li><strong>八度差会折算。</strong>比原唱高或低一个八度仍视作对应音符，方便按自己的音域演唱。</li>
        <li><strong>时间容差。</strong>每半秒最多可在前后 80 毫秒范围内对齐原唱，因此轻微早唱或晚唱不会直接扣分。</li>
        <li><strong>自动估算延迟。</strong>歌曲结束后，应用会在提前 0.3 秒到延后 1.5 秒之间寻找更匹配的延迟。</li>
      </ul>
      <p>这些规则偏向初学者。网站展示的数值仍属于上游版本记录，不代表随声练已完成新的验证。</p>

      <CreditPlayground />

      <h2>练习报告中的字段</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>字段</th><th>含义</th></tr></thead>
          <tbody>
            <tr><td><strong>总分</strong>（0–100）</td><td>平均音高得分乘以演唱覆盖比例。</td></tr>
            <tr><td><strong>音准</strong></td><td>你实际演唱期间的平均音高得分。</td></tr>
            <tr><td><strong>命中音符</strong></td><td>保持在半音以内至少半个音符时长的音符；前 80 毫秒不计，短于 0.15 秒的音符也不计。</td></tr>
            <tr><td><strong>演唱覆盖</strong></td><td>你参与演唱的部分占原唱主唱部分的比例。</td></tr>
            <tr><td><strong>音高倾向</strong></td><td>你整体偏高或偏低的中位误差，以音分计。</td></tr>
            <tr><td><strong>延迟</strong></td><td>应用估算并纳入计算的播放延迟。</td></tr>
          </tbody>
        </table>
      </div>

      <h3>演唱覆盖如何影响总分</h3>
      <p>总分 = 100 × 音准 × 覆盖系数。唱到原唱部分的 10% 时，覆盖系数约为 30%；随后随演唱覆盖率增加而提升，唱到 40% 后达到上限。这样做会降低只唱一小句或完全没有演唱时的总分。</p>
      <CoveragePlayground />

      <h2>上游项目的测量结果</h2>
      <p>OnKey 上游项目记录了人工标注歌曲、歌词对齐和演唱评分的测量结果。下表用于解释原算法的来源，不能当作随声练版本的独立验收结果。</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>上游记录中的检查</th><th className="num">结果</th></tr></thead>
          <tbody>
            <tr><td>人工标注的音符被音符条覆盖</td><td className="num">98%</td></tr>
            <tr><td>被覆盖音符落在正确音高</td><td className="num">92%</td></tr>
            <tr><td>音符条开始时间在 0.1 秒以内</td><td className="num">73%</td></tr>
            <tr><td>音符条下方没有演唱音高</td><td className="num">3%</td></tr>
            <tr><td>歌词行放置在 0.3 秒以内</td><td className="num">91–94%</td></tr>
          </tbody>
        </table>
      </div>

      <h3>评分与专家排序的一致度</h3>
      <p>上游项目在 PESnQ 数据集中比较了 20 段录音。下表是原项目报告的相关性，1 表示完全一致；样本较少，且未使用伴奏，因此只能作为算法背景。</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>比较对象</th><th className="num">与专家排序的一致度</th></tr></thead>
          <tbody>
            <tr><td>专家彼此之间</td><td className="num">0.88</td></tr>
            <tr><td>OnKey 命中音符</td><td className="num">0.77</td></tr>
            <tr><td>OnKey 总分</td><td className="num">0.61</td></tr>
          </tbody>
        </table>
      </div>

      <h2>已知限制</h2>
      <ul>
        <li><strong>说唱或对白：</strong>旋律音高较少，音准评分参考有限。</li>
        <li><strong>和声与合唱：</strong>模型可能把伴唱识别为主旋律，音符轨道可能偏离主唱。</li>
        <li><strong>使用扬声器：</strong>回声消除无法在所有环境中完全去除伴奏，耳机通常更稳定。</li>
        <li><strong>首次播放：</strong>歌曲尚未学习时不会显示完整音符轨道。</li>
        <li><strong>中文歌词：</strong>对齐能力尚未验证，时间标记可能不准确。</li>
      </ul>
    </>
  );
}
