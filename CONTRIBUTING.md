# 参与贡献

欢迎通过问题反馈和小范围 Pull Request 协助随声练。提交前请先阅读 [README.zh-CN.md](README.zh-CN.md) 了解项目状态、构建步骤、数据路径和许可。

## 报告问题

请在[随声练 GitHub Issues](https://github.com/aweiht/sing-practice/issues)提交问题，写明系统版本、Mac 型号、播放器、输出设备和可复现步骤。Issues 可能公开。提交前请检查文字和附件；不要上传录音、音乐文件、私密歌曲信息、凭据或其他个人资料。诊断日志可能包含歌曲名称。

中文歌词对齐和本版本 Shazam 新歌识别能力尚未验证。请把相关问题描述为待验证现象，不要默认它们已经通过支持性测试。

## 本地构建

目标环境为 Apple 芯片 Mac 和 macOS 14.2 或更新版本。还需要 Xcode Command Line Tools、Rust、Node.js 与 Python 3。

```sh
npm ci
npm --prefix ui ci
python3 -m venv .venv
.venv/bin/pip install -r scripts/requirements-models.txt
PYTHON=.venv/bin/python scripts/fetch-models.sh
npx tauri build
```

模型脚本会从上游来源下载模型并检查 SHA-256。模型文件较大且未纳入仓库。构建产物不会由本项目签名或公证，也没有发布安装包和自动更新服务。

构建中文静态网站文档：

```sh
npm --prefix site ci
npm --prefix site run build
```

## 相关检查

根据改动范围运行对应检查：

```sh
cd src-tauri && cargo test
npm --prefix ui test
npm --prefix ui run build
npm --prefix site run build
```

涉及音频定位、时间或评分的改动还需要在 Pull Request 中说明验证方法。不要为了测试上传真实歌曲、录音、个人数据或凭据。仓库没有可公开分享的真实音乐测试录音。

## Pull Request

- 一个 Pull Request 聚焦一个改动，说明解决的问题和运行过的检查。
- 保持隐私边界：不写入音乐音频，不加入未经说明的网络请求、用户追踪或外部服务依赖。
- 用户可见文字默认使用简体中文，并补齐可访问名称和必要说明。
- 保留 MIT 上游署名及第三方许可证原文；更新依赖时同步核对许可证。
- 不修改发布脚本、CI/CD 或生产配置，除非任务明确授权。

## 许可证

随声练保留上游 [MIT 许可证](LICENSE)，改编自 Daniel Murrell 的 [dsmurrell/onkey](https://github.com/dsmurrell/onkey)。第三方许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
