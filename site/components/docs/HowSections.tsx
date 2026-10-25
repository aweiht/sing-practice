"use client";
import Link from "next/link";
import { Levels } from "@/components/explain/Levels";
import { Scrolly } from "@/components/explain/Scrolly";
import { Glyph } from "@/components/explain/Glyph";
import { codeUrl, DATA_DIR } from "@/lib/site";
import { BIG_STEPS, BigPicture } from "@/components/diagrams/BigPicture";
import { HEAR_STEPS, Hearing } from "@/components/diagrams/Hearing";
import { LEARN_STEPS, Learning } from "@/components/diagrams/Learning";
import { PLACE_STEPS, Placement } from "@/components/diagrams/Placement";
import { ECHO_STEPS, Echo } from "@/components/diagrams/Echo";
import { CoveragePlayground, CreditPlayground, SCORE_STEPS, ScoreDiagram } from "@/components/diagrams/Scoring";
import { PRIVACY_STEPS, Privacy } from "@/components/diagrams/Privacy";

/** 源码链接：用于查看对应实现。 */
function Code({ path, children }: { path: string; children?: React.ReactNode }) {
  return <a href={codeUrl(path)}><code>{children ?? path.split("/").pop()}</code></a>;
}

/** 代码细节列表。 */
function Hood({ children }: { children: React.ReactNode }) {
  return <ul className="!mt-0 max-w-[65ch]">{children}</ul>;
}

const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <><p className="!mt-0 text-sm font-medium uppercase tracking-wider text-faint">{title}</p><p>{children}</p></>
);

export function HowSections() {
  return (
    <>
      <Levels
        id="big-picture" title="1. 整体流程"
        how={
          <Scrolly label="随声练的完整工作流程" diagram={(s) => <BigPicture step={s} />} steps={[
            <S key={0} title={BIG_STEPS[0]}>你照常在 <strong>Spotify、Apple Music 或 YouTube</strong> 播放音乐，随声练不会替你播放歌曲。</S>,
            <S key={1} title={BIG_STEPS[1]}>应用通过 macOS <strong>采集音乐播放器的声音</strong> <Glyph kind="wave" />，边播放边分析，不会保存音乐音频。</S>,
            <S key={2} title={BIG_STEPS[2]}>首次播放后，应用会学习歌手音高 <Glyph kind="separate" />、生成音符并尝试对齐歌词。</S>,
            <S key={3} title={BIG_STEPS[3]}>再次播放时，音符条 <Glyph kind="lane" /> 会随歌曲进度移动，麦克风采集到的音高 <Glyph kind="mic" /> 叠加显示。</S>,
            <S key={4} title={BIG_STEPS[4]}>歌曲结束后可查看 <strong>评分</strong> <Glyph kind="score" />、音符和逐行练习报告。</S>,
          ]} />
        }
        hood={
          <Hood>
            <li>这是一个 Mac 桌面应用：Rust 负责音频、模型和评分，Tauri 承载 React 界面。入口位于 <Code path="src-tauri/src/engine.rs" />。</li>
            <li>模型在本机运行，使用 ONNX Runtime；符合条件时也会使用 Core ML。音频重采样到 16 kHz，并以 10 毫秒为一帧（<Code path="src-tauri/src/dsp.rs" />）。</li>
            <li>歌曲听取覆盖率达到 70% 后记为已学习，具体阈值在 <Code path="src-tauri/src/store.rs">store.rs</Code> 的 <code>READY_COVERAGE</code> 中。</li>
          </Hood>
        }
      />

      <Levels
        id="hearing" title="2. 采集音乐与麦克风"
        how={
          <Scrolly label="随声练如何采集声音" diagram={(s) => <Hearing step={s} />} steps={[
            <S key={0} title={HEAR_STEPS[0]}>Mac 上可以同时有多个应用播放声音。</S>,
            <S key={1} title={HEAR_STEPS[1]}>获得系统权限后，随声练只采集你正在使用的<strong>音乐应用</strong>。</S>,
            <S key={2} title={HEAR_STEPS[2]}>麦克风与播放器声音按<strong>同一时钟</strong>采集，便于比较你在歌曲哪个时刻演唱。</S>,
            <S key={3} title={HEAR_STEPS[3]}>音乐在播放时留在内存中分析，不写入磁盘，也不会上传或分享。</S>,
          ]} />
        }
        hood={
          <Hood>
            <li>系统音频使用 Core Audio process tap（macOS 14.2 及以上），麦克风与输出设备使用同一采集时钟（<Code path="src-tauri/native/capture.swift" />、<Code path="src-tauri/src/capture.rs" />）。</li>
            <li>只选择音乐应用对应的进程采集声音（<Code path="src-tauri/src/source.rs" />）。</li>
            <li>音频转换为 16 kHz 单声道供模型分析。音乐不会写入文件；每次练习可保存你自己的麦克风录音。</li>
            <li>麦克风与系统音频录制是独立权限。控制 Spotify、Apple Music 或 YouTube 也是可选权限；关闭控制功能后，应用会尝试根据声音识别和定位。</li>
          </Hood>
        }
      />

      <Levels
        id="learning" title="3. 学习歌曲"
        how={
          <Scrolly label="随声练如何学习歌曲" diagram={(s) => <Learning step={s} />} steps={[
            <S key={0} title={LEARN_STEPS[0]}>刚开始时，收到的是歌手与乐器混合后的完整声音。</S>,
            <S key={1} title={LEARN_STEPS[1]}>歌曲结束后，分离模型 <Glyph kind="separate" /> 会从混合声音中提取主唱；处理时不保存音频文件。</S>,
            <S key={2} title={LEARN_STEPS[2]}>音高跟踪器每 10 毫秒分析一次歌手声音，可保留滑音与颤音变化。</S>,
            <S key={3} title={LEARN_STEPS[3]}>音符模型把音高变化转换成音符条，并标记每个音符的起止位置。</S>,
            <S key={4} title={LEARN_STEPS[4]}>歌词来自 LRCLIB。应用会使用语音模型尝试调整歌词行对应的演唱时间；中文歌词对齐能力尚未验证。</S>,
            <S key={5} title={LEARN_STEPS[5]}>歌词切分成音节后，会与对应音符条组合，供后续练习使用。</S>,
          ]} />
        }
        hood={
          <Hood>
            <li><strong>人声分离：</strong>使用 UVR MDX-Net Karaoke 2 模型，每次处理 20 秒片段，并保留两侧各 2 秒上下文（<Code path="src-tauri/src/learn.rs" />、<Code path="src-tauri/src/mdx.rs" />）。</li>
            <li><strong>音高：</strong>使用 CREPE full 模型分析分离后的人声，采样率 16 kHz，时间步长 10 毫秒，范围约 50–1100 Hz（<Code path="src-tauri/src/pitch.rs" />）。</li>
            <li><strong>音符：</strong>GAME 模型从人声提取音符，再将音符与歌词音节对应（<Code path="src-tauri/src/game.rs" />、<Code path="src-tauri/src/syllables.rs" />）。</li>
            <li><strong>歌词：</strong>使用 wav2vec 2.0（CTC）重新定位整首歌的歌词行，再通过 CMU 发音词典切分音节（<Code path="src-tauri/src/lyrics.rs" />、<Code path="src-tauri/src/ctc.rs" />）。中文歌词对齐尚未验证。</li>
            <li><strong>上游版本的人工标注结果：</strong>18 首歌曲的音符覆盖率为 98%，正确音高为 92%，起始时间在 0.1 秒内的比例为 73%；歌词行在 0.3 秒内的比例为 94%。这些数据不是随声练版本的复测结果。</li>
          </Hood>
        }
      />

      <Levels
        id="placement" title="4. 定位歌曲进度"
        how={
          <Scrolly label="随声练如何定位歌曲进度" diagram={(s) => <Placement step={s} />} steps={[
            <S key={0} title={PLACE_STEPS[0]}>每首已学习歌曲会保存一份<strong>声音指纹</strong> <Glyph kind="fingerprint" />，记录不同频段声音随时间的变化。</S>,
            <S key={1} title={PLACE_STEPS[1]}>应用把正在播放的几秒声音与这份指纹进行匹配。</S>,
            <S key={2} title={PLACE_STEPS[2]}>匹配结果用于估算歌曲当前位置；完成定位前，音符会保持变暗。</S>,
            <S key={3} title={PLACE_STEPS[3]}>你跳转、快进或重新播放后，应用会重新寻找匹配位置。</S>,
            <S key={4} title={PLACE_STEPS[4]}>已学习歌曲可在本机识别。Shazam 新歌识别需要自有开发者标识；随声练尚未配置，该能力尚未验证。</S>,
          ]} />
        }
        hood={
          <Hood>
            <li><strong>声音指纹：</strong>每 10 毫秒记录约 60 Hz 至 7 kHz 范围内 8 个频段的变化（<code>FP_BANDS</code>，见 <Code path="src-tauri/src/dsp.rs" />）。</li>
            <li><strong>匹配定位：</strong>追踪器会将最多 8 秒的当前声音与歌曲指纹比较，并保留多个加权候选位置（<Code path="src-tauri/src/tracker.rs" />）。</li>
            <li><strong>上游版本测试：</strong>在 153 次播放位置偏移回放中，定位点约有 91% 的时间落在实际音乐位置 0.1 秒以内。该数据未经随声练版本独立复测。</li>
          </Hood>
        }
      />

      <Levels
        id="you" title="5. 采集你的声音"
        how={
          <Scrolly label="回声消除原理" diagram={(s) => <Echo step={s} />} steps={[
            <S key={0} title={ECHO_STEPS[0]}>使用扬声器时，麦克风会同时收到你和歌曲的声音。</S>,
            <S key={1} title={ECHO_STEPS[1]}>应用也在同一时钟上采集播放器声音 <Glyph kind="wave" />。</S>,
            <S key={2} title={ECHO_STEPS[2]}>滤波器会估算房间、扬声器和延迟如何改变伴奏传到麦克风后的声音。</S>,
            <S key={3} title={ECHO_STEPS[3]}>再从麦克风信号中减去估算出的伴奏 <Glyph kind="echo" />，尝试保留你的声音。</S>,
            <S key={4} title={ECHO_STEPS[4]}>使用耳机时，麦克风通常收不到扬声器伴奏，练习结果会更稳定。</S>,
          ]} />
        }
        hood={
          <Hood>
            <li><strong>实时音高：</strong>CREPE tiny 模型处理经过回声消除的麦克风信号，每 10 毫秒更新一次（<Code path="src-tauri/src/pitch.rs" />）。</li>
            <li><strong>回声消除：</strong>使用分块频域自适应滤波器，16 个分块，每块 256 个采样点，采样率 16 kHz（<Code path="src-tauri/src/bleed.rs" />）。滤波器还会定期估算最长约 800 毫秒的回声延迟。</li>
            <li><strong>限制：</strong>扬声器音量较大、环境回声明显或延迟过长时，伴奏仍可能进入麦克风信号并影响评分。耳机通常更可靠。</li>
          </Hood>
        }
      />

      <Levels
        id="scoring" title="6. 计算评分"
        how={
          <>
            <Scrolly label="随声练如何计算演唱评分" diagram={(s) => <ScoreDiagram step={s} />} steps={[
              <S key={0} title={SCORE_STEPS[0]}>你与原唱都在演唱时，应用会把你的音高与原唱音高和音符条比较，采用较接近的一项。</S>,
              <S key={1} title={SCORE_STEPS[1]}>音高差在 <strong>50 音分</strong>以内时得满分；到 150 音分时得分降为零。</S>,
              <S key={2} title={SCORE_STEPS[2]}><strong>八度差会折算</strong>，便于按自己的音域演唱。</S>,
              <S key={3} title={SCORE_STEPS[3]}>每半秒内最多调整 <strong>80 毫秒</strong>，减少轻微早唱或晚唱对结果的影响。</S>,
              <S key={4} title={SCORE_STEPS[4]}>音符保持在半音范围内至少半段时长，才会记录为<strong>命中</strong>；前 80 毫秒不计。</S>,
              <S key={5} title={SCORE_STEPS[5]}>总分 <Glyph kind="score" /> 结合<strong>音准</strong>与<strong>演唱覆盖比例</strong>，避免只唱一小段也得到很高的总分。</S>,
            ]} />
            <div className="wide mt-8 grid gap-5 xl:grid-cols-2">
              <CreditPlayground />
              <CoveragePlayground />
            </div>
            <p>当前评分规则偏向初学者。字段定义和已知限制见<Link href="/docs/scoring/">评分说明</Link>。</p>
          </>
        }
        hood={
          <Hood>
            <li><strong>音高得分：</strong><code>clamp((150 − |error|) / 100, 0, 1)</code>，误差单位为音分，并折算八度差（<code>credit</code>、<code>fold</code>，见 <Code path="src-tauri/src/dsp.rs" />）。</li>
            <li><strong>时间容差：</strong>每 0.5 秒片段在 ±80 毫秒内寻找最匹配的偏移。</li>
            <li><strong>演唱覆盖：</strong><code>100 × accuracy × (0.3 × min(1, sung / 0.1) + 0.7 × min(1, sung / 0.4))</code>；覆盖原唱部分达到 40% 时，覆盖系数达到上限。</li>
            <li><strong>与专家评分比较：</strong>上游版本在 20 段录音上的命中音符一致度为 0.77、总分为 0.61；此结果未在随声练版本复测。</li>
          </Hood>
        }
      />

      <Levels
        id="privacy" title="7. 隐私与数据"
        how={
          <Scrolly label="随声练保存与发送的数据" diagram={(s) => <Privacy step={s} />} steps={[
            <S key={0} title={PRIVACY_STEPS[0]}>歌曲音符、歌词时间信息与麦克风练习录音保存在本机 <Glyph kind="lock" />，供后续练习和回听。</S>,
            <S key={1} title={PRIVACY_STEPS[1]}>应用<strong>不会保存或发送正在播放的音乐音频</strong>，也不会保存分离出的人声。扬声器声音可能进入麦克风练习录音。</S>,
            <S key={2} title={PRIVACY_STEPS[2]}>查询歌词时会把歌曲名、歌手、专辑和时长发送给 LRCLIB；查询封面时会向 Apple 发送歌手和歌名。</S>,
            <S key={3} title={PRIVACY_STEPS[3]}>项目没有自有 Shazam Developer ID，因此这项新歌识别能力尚未验证。若该能力可用，请求发送的是音乐指纹，不是麦克风录音。</S>,
          ]} />
        }
        hood={
          <Hood>
            <li>随声练应用数据位于 <code>{DATA_DIR}</code>。歌曲、歌词缓存、练习录音和诊断记录由应用分别管理；录音可能包含扬声器播放的声音。</li>
            <li>联网请求包括 LRCLIB 歌词查询、Apple 歌曲信息与封面，以及尚未验证的 ShazamKit 新歌识别。应用自动更新已关闭，不会请求 GitHub Releases。</li>
            <li>无账号、无自建服务端、无网站分析统计或崩溃上报。完整内容见<Link href="/docs/privacy/">隐私与法律</Link>。</li>
          </Hood>
        }
      />
    </>
  );
}
