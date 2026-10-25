import type { Metadata } from "next";
import { Privacy as PrivacyDiagram } from "@/components/diagrams/Privacy";
import { DATA_DIR, GITHUB_URL, ISSUES_URL, NOT_AFFILIATED, codeUrl } from "@/lib/site";

export const metadata: Metadata = { title: "隐私与法律" };

export default function Privacy() {
  return (
    <>
      <h1>隐私与法律</h1>
      <p className="lede">
        随声练在你的 Mac 上分析播放中的音乐，不会保存或上传音乐音频。练习录音、学到的音符和歌词保存在本机。以下说明列出本项目处理的数据与网络请求。
      </p>

      <figure className="wide -mx-4 overflow-hidden border-y border-line sm:mx-0 sm:rounded-2xl sm:border" style={{ maxWidth: "40rem" }}>
        <PrivacyDiagram all />
      </figure>

      <h2>保存在 Mac 上的数据</h2>
      <p>应用数据目录：<code>{DATA_DIR}</code>。</p>
      <ul>
        <li><strong>歌曲信息</strong>：学习到的音高、音符轨道、节奏指纹，以及歌词时间信息。若启用歌曲识别，也可能保存用于本机识别的音乐指纹。</li>
        <li><strong>歌词</strong>：从 LRCLIB 获取的歌词与缓存信息。关闭歌词后不会查询新歌词；本机已有歌词由应用的删除操作管理。</li>
        <li><strong>练习录音</strong>：麦克风录音、评分和练习报告会保存在本机以供回听。若音乐通过扬声器播放，录音可能包含部分伴奏。</li>
        <li><strong>故障诊断信息</strong>：日志和每次播放的摘要可能包含歌曲名称、时间、性能数字、应用版本和设备信息，不包含音乐音频。</li>
        <li><strong>设置与缓存</strong>：应用偏好、封面缓存和模型缓存等运行所需文件。</li>
      </ul>
      <p>本版本使用独立的数据目录，不读取或改写 OnKey 原版的数据。退出应用后，可按应用自身提供的管理操作删除歌曲或录音；直接删除整个目录会一并删除随声练保存的数据。</p>

      <h2>不会保存的内容</h2>
      <p>应用分析正在播放的音乐音频，并在处理时保留在内存中；不会将这段音乐或分离出的伴奏、歌声写入文件、上传、分享或导出。麦克风练习录音可能带入扬声器播放的部分音乐。</p>

      <h2>应用发出的网络请求</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>服务</th><th>发送内容与用途</th></tr></thead>
          <tbody>
            <tr>
              <td><strong><a href="https://lrclib.net">LRCLIB</a></strong></td>
              <td>查询同步歌词时发送歌曲名、歌手、专辑和时长。关闭歌词后不会发起新的歌词查询。</td>
            </tr>
            <tr>
              <td><strong>Apple iTunes Search / Lookup</strong></td>
              <td>查询封面或歌曲信息时发送歌手、歌名或歌曲编号。封面图片由相应的 Apple、Spotify 或 YouTube 图片服务提供。</td>
            </tr>
            <tr>
              <td><strong>Apple ShazamKit</strong></td>
              <td>项目没有自有 Shazam Developer ID；本版 Shazam 新歌识别能力尚未验证，可能不可用。若识别功能可用，会发送由音乐生成的短指纹，而不是原始音频，也不会发送麦克风录音。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>本版本的应用自动更新已关闭，不会向 GitHub 检查或下载应用更新。应用没有账号系统、随声练自建服务端、分析统计或崩溃上报。故障报告只在你主动创建报告并提交到 GitHub Issues 后才会离开本机；日志可能包含歌曲名称，请先检查报告内容。</p>

      <h2>网站文档</h2>
      <p>网站源码使用静态页面，不包含原站分析脚本或演示媒体请求。当前没有部署官网；浏览器访问本仓库链接时，GitHub 会按其自身政策处理访问数据。点击外部服务链接后，相应服务会收到普通网页请求。</p>

      <h2>音乐服务与版权</h2>
      <p>随声练不提供、串流或下载音乐，也不使用音乐服务的开发者 API 或 SDK，不读取其他应用的文件、内存或加密信息。音乐仍由你自己的播放器播放；使用方式应遵循相应服务条款和版权规定。</p>

      <h2>权利人反馈</h2>
      <p>权利人或服务方如有疑虑，请通过<a href={ISSUES_URL}>随声练 GitHub Issues</a>反馈。Issue 可能公开，请勿在公开内容中提交不应公开的个人资料。项目当前没有单独公布的权利人联系邮箱。项目源码位于<a href={GITHUB_URL}>公开仓库</a>，另见<a href={codeUrl("LEGAL.md")}>仓库法律说明</a>。</p>

      <h2>商标</h2>
      <p>{NOT_AFFILIATED}</p>

      <h2>许可证与来源</h2>
      <p>随声练改编自 Daniel Murrell 的 <a href="https://github.com/dsmurrell/onkey">dsmurrell/onkey（OnKey）</a>，保留 MIT 许可证和上游署名。模型及第三方依赖的完整许可文本见<a href={codeUrl("THIRD_PARTY_NOTICES.md")}>第三方声明</a>与<a href="/docs/credits/">致谢与许可</a>。</p>
    </>
  );
}
