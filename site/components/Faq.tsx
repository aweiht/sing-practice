import Link from "next/link";
import { DATA_DIR, GITHUB_URL, ISSUES_URL, RELEASE_URL } from "@/lib/site";

export type QA = { id: string; q: string; a: React.ReactNode };

/** 首页与常见问题页共用的基础问答。 */
export const FIRST_QUESTIONS: QA[] = [
  {
    id: "network",
    q: "有哪些数据会离开我的 Mac？",
    a: (
      <>
        <p>应用会在本机分析音乐，不会保存或上传音乐音频。联网请求包括：</p>
        <ul>
          <li><strong>LRCLIB</strong>：查询同步歌词时会发送歌曲名、歌手、专辑和时长；关闭歌词后不会查询。</li>
          <li><strong>Apple</strong>：查询专辑封面和歌曲信息时会发送歌手、歌名或歌曲编号。</li>
          <li><strong>Apple ShazamKit</strong>：项目没有配置自有 Shazam Developer ID，这项新歌识别能力尚未验证。若识别功能可用，会发送音乐指纹，不会发送麦克风音频。</li>
        </ul>
        <p>应用无需账号，也没有随声练自建服务端、网站统计或崩溃上报。网站文档本身不加载分析脚本。完整说明见<Link href="/docs/privacy/">隐私与法律</Link>。</p>
      </>
    ),
  },
  {
    id: "music",
    q: "随声练会提供或下载歌曲吗？",
    a: <p>不会。歌曲由你正在使用的 Spotify、Apple Music 或浏览器中的 YouTube 播放。随声练只分析播放中的声音，不提供音乐下载或曲库。</p>,
  },
  {
    id: "kept",
    q: "随声练会在 Mac 上保存什么？",
    a: <p>应用会保存歌曲音符、歌词及其时间信息，以及每次练习的麦克风录音和评分，供你回听。数据位于 <code>{DATA_DIR}</code>。扬声器播放时，录音可能包含部分伴奏；应用不会保存独立的音乐音频。</p>,
  },
  {
    id: "permissions",
    q: "应用需要哪些权限？",
    a: (
      <ul>
        <li><strong>麦克风</strong>：采集你的演唱并生成练习录音。</li>
        <li><strong>系统音频录制</strong>：分析正在播放的音乐。macOS 使用“录制”一词，但应用只在播放时分析，不会保存音乐音频。</li>
        <li><strong>控制音乐应用或浏览器</strong>：如果启用对应控制功能，应用可读取播放位置并控制播放、暂停或跳转；也可选择只听声音，不控制播放器。</li>
      </ul>
    ),
  },
  {
    id: "macs",
    q: "支持哪些 Mac？",
    a: <p>目标环境为搭载 Apple 芯片（M1 或更新机型）、运行 macOS 14.2 或更新版本的 Mac。Intel Mac 不在支持范围内。当前提供未经过 Apple 公证的预览安装包，首次打开可能需要按 macOS 提示手动确认。</p>,
  },
  {
    id: "platforms",
    q: "为什么没有 Windows、Linux 或手机版本？",
    a: <p>当前实现依赖 macOS 的单应用音频采集与 Core ML，其他平台尚未移植。如需反馈，请在<a href={ISSUES_URL}>随声练 GitHub Issues</a>提交建议。</p>,
  },
  {
    id: "browser",
    q: "为什么不做成网页？",
    a: <p>普通网页无法直接读取 Spotify 或 Apple Music 桌面应用的播放声音和位置，也无法调用 macOS 的 ShazamKit、Core ML 能力。因此当前产品是 Mac 应用，网站仅提供说明文档。</p>,
  },
  {
    id: "scoring",
    q: "评分如何计算？",
    a: <p>应用以短时间帧比较你的音高与歌手音高，在一定音高误差和时间偏差内给予分数，并按演唱覆盖比例调整总分。算法说明与限制见<Link href="/docs/scoring/">评分说明</Link>；网站中的上游测量数据尚未在中文歌曲上复测。</p>,
  },
  {
    id: "licence",
    q: "项目使用什么许可证？",
    a: <p>随声练保留上游 MIT 许可证，改编自 Daniel Murrell 的 <a href="https://github.com/dsmurrell/onkey">dsmurrell/onkey（OnKey）</a>。模型和其他第三方组件各有许可证，详见<Link href="/docs/credits/">致谢与许可</Link>及仓库中的 <a href={`${GITHUB_URL}/blob/HEAD/THIRD_PARTY_NOTICES.md`}>第三方声明</a>。</p>,
  },
];

/** 使用过程中的问答。 */
export const MORE_QUESTIONS: QA[] = [
  {
    id: "first-play",
    q: "为什么第一次播放时没有音符？",
    a: <p>首次播放用于分析歌曲并学习音符。处理完成前会显示歌词而不是音符轨道；再次播放时才会显示学习到的音符。歌词对齐能力尚未针对中文歌曲验证。</p>,
  },
  {
    id: "learning",
    q: "学习歌曲要多久？",
    a: <p>处理时间取决于歌曲长度、Mac 性能和当时的系统负载。应用会在歌曲播放结束后处理；如果一首歌曲正在学习，其他歌曲可能需要等待。</p>,
  },
  {
    id: "starters",
    q: "适合先练习哪些歌曲？",
    a: <p>旋律清晰、主唱突出、伴奏和声较少的歌曲通常更容易分析。说唱、对白、合唱和复杂和声可能影响音符提取与评分。</p>,
  },
  {
    id: "busy",
    q: "歌曲分析会占用多少 Mac 资源？",
    a: <p>首次学习歌曲比回放已学习歌曲更耗资源，具体占用随设备、模型与歌曲变化。原版上游曾公开部分机器上的测量结果，但这些数据尚未在随声练版本和中文曲目上复测，不能视作当前设备的性能保证。</p>,
  },
  {
    id: "headphones",
    q: "练习时需要戴耳机吗？",
    a: <p>不需要，但使用耳机通常更容易获得稳定结果。使用扬声器时，麦克风会同时收进你的声音和部分伴奏，回声消除无法在所有设备与音量下完全去除伴奏。</p>,
  },
  {
    id: "octave",
    q: "可以用比原唱高或低的八度唱吗？",
    a: <p>可以。评分会把相差一个或多个八度的对应音高视作同一音，方便你按自己的音域演唱。</p>,
  },
  {
    id: "apps",
    q: "目前支持哪些音乐应用？",
    a: <p>项目面向 Spotify、Apple Music，以及 Chrome、Brave、Edge 或 Safari 浏览器中的 YouTube。不同播放器控制能力与识别能力可能不同；是否可用以当前构建和系统权限为准。</p>,
  },
  {
    id: "shazam",
    q: "Shazam 会把我的录音发送给 Apple 吗？",
    a: <p>ShazamKit 通过音乐音频生成短指纹，识别请求不包含麦克风音频。随声练没有配置自有 Shazam Developer ID，因此这项能力尚未验证，可能无法使用。项目启用该能力后，隐私说明会列出请求内容。</p>,
  },
  {
    id: "chinese-lyrics",
    q: "中文歌词能准确对齐吗？",
    a: <p>目前没有验证中文歌词对齐模型的准确度。对齐结果可能偏早、偏晚或不完整，请勿把它当作已支持的中文歌词准确率承诺。你可以在<a href={ISSUES_URL}>GitHub Issues</a>反馈问题。</p>,
  },
  {
    id: "lyrics-off",
    q: "可以关闭歌词吗？",
    a: <p>可以。应用设置中的歌词开关关闭后，不会查询新的歌词；已经保存在本机的歌词会被隐藏，是否删除取决于应用的数据管理操作。音符和评分仍可能使用歌曲音高信息。</p>,
  },
  {
    id: "odd-scores",
    q: "为什么有些歌曲的评分不准确？",
    a: <p>说唱或对白缺少稳定旋律，多人和声也可能让模型难以分辨主唱。使用扬声器时，伴奏还可能进入麦克风录音。更多限制见<Link href="/docs/scoring/">评分说明</Link>。</p>,
  },
  {
    id: "report",
    q: "如何反馈问题？",
    a: <p>请在<a href={ISSUES_URL}>随声练 GitHub Issues</a>提交问题，并说明系统版本、设备和复现步骤。Issues 内容可能公开；提交前请检查附件，不要上传录音、私密歌曲信息、密钥或其他个人资料。故障日志可能包含播放过的歌曲名称。</p>,
  },
  {
    id: "updates",
    q: "如何获取新版？",
    a: <p>应用自动更新已关闭。请到<a href={RELEASE_URL}>GitHub 发布页</a>下载安装包并查看说明；开发者也可按<Link href="/docs/">构建指南</Link>自行构建。</p>,
  },
];

/** 首页与文档共用的原生展开问答。 */
export function FaqList({ items }: { items: QA[] }) {
  return (
    <div className="grid gap-3" role="group" aria-label="常见问题列表">
      {items.map(({ id, q, a }) => (
        <details key={id} id={`faq-${id}`} className="group scroll-mt-24 rounded-xl border border-line bg-panel [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-medium text-fg">
            {q}
            <span aria-hidden="true" className="text-lg leading-none text-faint transition group-open:rotate-45 motion-reduce:transition-none">+</span>
          </summary>
          <div className="faq-answer px-4 pb-4 text-[15px] leading-relaxed text-fg-soft">{a}</div>
        </details>
      ))}
    </div>
  );
}
