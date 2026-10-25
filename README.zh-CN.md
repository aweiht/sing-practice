# 随声练

[English README](README.md)

随声练是一款简体中文开源 Mac 歌唱练习应用。它从 Mac 正在播放的音乐中学习歌手旋律，在你演唱时显示音符条和实时音高。应用不提供或下载音乐。

本项目改编自 Daniel Murrell 的 [dsmurrell/onkey（OnKey）](https://github.com/dsmurrell/onkey)，保留上游 MIT 许可证与署名。第三方模型和依赖的声明原文保存在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 当前可用状态

本仓库只提供源码，目前没有中文版安装包或 Release 下载，没有已部署的网站或官网域名，也没有本项目自己的 Apple Developer ID 证书与公证配置。应用自动更新已关闭。从源码构建不等于获得签名或公证的发布安装包。

本版本没有自有 Shazam Developer ID，因此 Shazam 新歌识别能力尚未验证，可能无法使用。中文歌词对齐能力也尚未验证。OnKey 上游记录的英文测量结果不代表本改版的性能验证结果。

其他已知问题和验证边界见[已知问题](docs/KNOWN_ISSUES.md#已知问题)。

## 从源码构建 Mac 应用

目标环境为搭载 Apple 芯片（M1 或更新机型）、运行 macOS 14.2 或更新版本的 Mac。请先安装 Xcode Command Line Tools、Rust、Node.js 与 Python 3。

```sh
git clone https://github.com/aweiht/sing-practice.git
cd sing-practice
npm ci
npm --prefix ui ci
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-models.txt
PYTHON=.venv/bin/python scripts/fetch-models.sh
npx tauri build
```

模型脚本会下载应用所需模型并校验 SHA-256；模型文件不会提交到 Git。构建使用本机工具链，本项目不会为其签名或公证；首次打开时 macOS 可能阻止运行。该源码构建不会启用自动更新。

本轮使用官方发布包中的模型，并逐项对照模型 manifest 校验 SHA-256 和文件尺寸后，`cargo test`、`cargo check` 与 `cargo build` 均通过。Python 模型导出路线本轮未重跑；签名、公证、真实音频运行和模型导出均未验证。

单独构建静态网站文档：

```sh
npm --prefix site ci
npm --prefix site run build
```

构建文件写入 `site/out/`，不会自动部署网站。

## 隐私与数据

音乐音频只在内存中分析，不会保存或上传。应用会保存学到的歌曲信息、歌词、练习评分、诊断记录和供回听的麦克风录音。使用扬声器练习时，录音可能包含部分音乐。随声练应用数据单独保存在 `~/Library/Application Support/io.github.aweiht.sing-practice/`，不会读取或改写 OnKey 原版数据目录。

应用可能向 LRCLIB 查询同步歌词，并向 Apple 服务查询歌曲或封面信息。ShazamKit 新歌识别能力尚未验证。应用自动更新检查已关闭。网站源码不含分析统计脚本。

问题反馈请使用 [GitHub Issues](https://github.com/aweiht/sing-practice/issues)。Issues 可能公开，请先检查附件；日志可能包含歌曲名称。不要上传录音、凭据或其他私密信息。

## 仓库目录与维护

- `.github/`：Issue 表单与仓库模板。
- `design/`：项目设计资料。
- `docs/`：贡献说明和发布历史文档。`docs/RELEASING.md` 是上游历史参考，不得直接用于本项目。
- `scripts/`：源码构建与项目校验辅助脚本。
- `site/`：中文静态介绍页和用户文档。
- `src-tauri/`：Rust 应用、macOS 原生集成和 Tauri 配置。
- `ui/`：React 桌面界面。

贡献时请勿将本地构建产物、下载的模型文件或凭据提交到仓库。

## 许可证与上游致谢

项目保留上游 [MIT 许可证](LICENSE)，并注明 Daniel Murrell / [dsmurrell/onkey](https://github.com/dsmurrell/onkey) 为上游来源。完整第三方许可证文本见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。另见当前项目说明 [LEGAL.md](LEGAL.md) 和网站构建说明 [site/README.md](site/README.md)。
