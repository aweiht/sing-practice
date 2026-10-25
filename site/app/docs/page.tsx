import type { Metadata } from "next";
import { GITHUB_URL, REQUIREMENTS, codeUrl } from "@/lib/site";

export const metadata: Metadata = { title: "源码构建指南" };

export default function GettingStarted() {
  return (
    <>
      <h1>源码构建指南</h1>
      <p className="lede">随声练目前没有中文版发布安装包，也没有已部署的官网。本页介绍如何从公开源码构建 Mac 应用。</p>

      <h2>构建应用前需要准备</h2>
      <ul>
        {REQUIREMENTS.map((r) => <li key={r}>{r}</li>)}
        <li>安装 Xcode Command Line Tools、Rust、Node.js 和 Python 3。</li>
        <li>需要联网下载并校验随应用分发的机器学习模型；模型文件不会提交到仓库。</li>
      </ul>

      <h2>构建 Mac 应用</h2>
      <p>先克隆项目并安装 JavaScript 依赖，再准备模型并调用 Tauri 构建：</p>
      <pre><code>{`git clone ${GITHUB_URL}.git
cd sing-practice
npm ci
npm --prefix ui ci
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-models.txt
PYTHON=.venv/bin/python scripts/fetch-models.sh
npx tauri build`}</code></pre>
      <p>
        模型下载脚本会校验文件 SHA-256。模型、Python 依赖和 Rust 编译会占用较多磁盘空间与网络流量；具体输出位置由本机 Tauri 配置决定。
        从源码构建不等于获得已签名的安装包：本项目没有自有 Apple Developer ID 证书与公证配置，首次打开时 macOS 可能阻止运行。
      </p>
      <p>
        项目没有配置本版的 Shazam Developer ID，因此 Shazam 新歌识别能力尚未验证，可能不可用。中文歌词对齐模型也未经过验证；其他歌曲分析能力沿用上游实现。
      </p>

      <h2>构建网站文档</h2>
      <p>网站代码位于 <code>site/</code>，单独安装依赖并生成静态文件：</p>
      <pre><code>{`npm --prefix site ci
npm --prefix site run build`}</code></pre>
      <p>构建结果写入 <code>site/out/</code>。当前只提供源码构建说明，没有官网域名或网站部署。</p>

      <h2>源代码与许可</h2>
      <p>
        <a href={GITHUB_URL}>查看随声练源码仓库</a>。本项目改编自 Daniel Murrell 的
        <a href="https://github.com/dsmurrell/onkey"> dsmurrell/onkey（OnKey）</a>，保留 MIT 许可与上游署名。
        模型和其他第三方组件各自遵循其许可；完整文本见
        <a href={codeUrl("THIRD_PARTY_NOTICES.md")}> THIRD_PARTY_NOTICES.md</a> 与
        <a href="/docs/credits/">致谢与许可</a>。
      </p>
    </>
  );
}
