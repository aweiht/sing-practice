import Link from "next/link";
import { DownloadButton } from "@/components/DownloadButton";
import { LaneArt } from "@/components/LaneArt";
import { FIRST_QUESTIONS, FaqList } from "@/components/Faq";
import { GITHUB_URL, REQUIREMENTS } from "@/lib/site";

const FACTS = [
  "MIT 许可证开源",
  "支持 Apple 芯片，要求 macOS 14.2 或更新版本",
  "本机运行，无需账号",
  "不会保存正在分析的音乐",
];

const STEPS = [
  {
    title: "播放一首歌",
    body: "像平时一样使用 Spotify、Apple Music 或浏览器中的 YouTube。随声练会跟随分析，不会播放或下载音乐。",
  },
  {
    title: "首次播放时学习旋律",
    body: "歌曲结束后，随声练会尝试提取歌手音高、生成音符并对齐歌词。处理时间取决于设备与歌曲。",
  },
  {
    title: "跟着音高参考演唱",
    body: "再次播放时，音符会向当前进度移动，你的音高会叠加显示。绿色表示接近目标音，红色表示偏差较大。",
  },
  {
    title: "查看练习结果",
    body: "你可以查看评分、命中或偏离的音符，并回听自己的录音。",
  },
];

const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-medium transition";
const primary = `${btn} bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-strong`;
const secondary = `${btn} border border-line text-fg hover:bg-panel`;

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(700px_300px_at_50%_30%,var(--accent-wash),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="rise grid gap-6">
            <p className="text-sm font-medium text-accent-soft">面向 Mac 的开源歌唱练习工具</p>
            <h1 className="text-[2.15rem] font-semibold leading-[1.1] tracking-tight text-fg sm:text-5xl sm:leading-[1.08]">
              跟着喜欢的歌，练习唱准每一个音。
            </h1>
            <p className="max-w-[54ch] text-lg leading-relaxed text-muted">
              随声练从 Mac 正在播放的音乐中学习歌手旋律，并在你演唱时呈现音高参考，让你看见音准偏差。
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <DownloadButton where="top" className={primary} />
              <a href={GITHUB_URL} className={secondary}><GitHubMark />查看源码</a>
              <Link href="/docs/how-it-works/" className="inline-flex min-h-12 items-center px-2 font-medium text-accent-soft underline-offset-4 hover:underline">
                工作原理 →
              </Link>
            </div>
            <ul className="grid gap-x-6 gap-y-1.5 text-sm text-muted sm:grid-cols-2" aria-label="产品概览">
              {FACTS.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-good" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <figure className="rise grid gap-3" style={{ animationDelay: "120ms" }}>
            <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/20">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 truncate text-xs text-muted">练习示意 · 得分 82</span>
              </div>
              <LaneArt />
            </div>
            <figcaption className="text-center text-xs text-muted">
              音符轨道与音高位置示意图，非真实演唱录像。
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="border-t border-line bg-bg-raised" aria-labelledby="how">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="how" className="text-2xl font-semibold tracking-tight text-fg">使用流程</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="grid content-start gap-2 rounded-2xl border border-line bg-panel p-5">
                <span className="tabular text-base font-medium text-accent-soft">步骤 {i + 1}</span>
                <h3 className="text-lg font-semibold text-fg">{s.title}</h3>
                <p className="text-base leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-base text-muted">
            需要了解细节？查看带图解的<Link href="/docs/how-it-works/" className="text-accent-soft underline underline-offset-4">工作原理说明</Link>。
          </p>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="privacy">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
          <div className="grid content-start gap-4">
            <h2 id="privacy" className="text-2xl font-semibold tracking-tight text-fg">只分析音乐，不保存音乐</h2>
            <p className="leading-relaxed text-muted">
              随声练会在本机分析正在播放的音乐，以学习旋律并校准进度，不会保存或上传音乐。应用会保存学到的音符以及每次练习的麦克风录音，供你回听。
            </p>
            <Link href="/docs/privacy/" className="text-sm text-accent-soft underline underline-offset-4">隐私与法律说明</Link>
          </div>
          <ul className="grid content-start gap-3">
            {[
              ["无账号、无服务端、无网站统计", "应用联网请求只用于歌词查询、专辑封面和歌曲识别；详情见隐私说明。"],
              ["评分会考虑演唱音域", "高低八度会按同一个音计算，并为演唱与伴奏的时差预留容差。"],
              ["耳机或扬声器均可练习", "耳机通常能获得更稳定的评分。使用扬声器时，麦克风也可能收进部分伴奏。"],
            ].map(([t, b]) => (
              <li key={t} className="rounded-2xl border border-line bg-panel p-4">
                <p className="font-medium text-fg">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{b}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line bg-bg-raised" aria-labelledby="faq">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid content-start gap-3">
            <h2 id="faq" className="text-2xl font-semibold tracking-tight text-fg">常见问题</h2>
            <p className="text-muted">先看几个常见问题。<Link href="/docs/faq/" className="text-accent-soft underline underline-offset-4">查看全部问题</Link>。</p>
          </div>
          <FaqList items={FIRST_QUESTIONS} />
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="get">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
          <div className="grid gap-2">
            <h2 id="get" className="text-2xl font-semibold tracking-tight text-fg">下载安装</h2>
            <p className="text-muted">随声练遵循 MIT 许可证开源。{REQUIREMENTS.join("；")}。提供包含学习模型的未公证预览安装包。</p>
          </div>
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <DownloadButton where="bottom" className={primary} />
            <a href={GITHUB_URL} className={secondary}><GitHubMark />查看源码</a>
          </div>
        </div>
      </section>
    </>
  );
}
