# 发布说明（上游历史参考）

> **重要：本文仅用于说明上游 OnKey 的历史发布流程，不适用于随声练，不能直接执行其中的脚本、命令、密钥路径或发布步骤。**
>
> 本项目提供未经过 Apple 公证的预览安装包，但没有自动更新配置、自有 Apple Developer ID 签名、公证材料或上游发布凭据。不得将上游发布流程用于本仓库。

## 上游流程摘要

原始文件来自 Daniel Murrell 的 [dsmurrell/onkey](https://github.com/dsmurrell/onkey)，描述其 OnKey 版本如何构建带模型的 Mac 安装包、签名和公证、生成更新文件、校验 SHA-256，再创建 GitHub Release。上游流程依赖其专属签名、更新密钥、Apple 配置和发布脚本。

其中出现的 `scripts/release.sh`、`scripts/make-dmg.sh`、`scripts/check-release.sh`、`scripts/check-dmg.sh`、更新密钥和 GitHub Release 地址都属于上游历史内容。随声练没有对应的签名身份、更新密钥或正式发布流程；自动更新也已关闭。

## 随声练当前状态

Apple Silicon 的预览 DMG 及 SHA-256 校验和见 [GitHub 发布页](https://github.com/aweiht/sing-practice/releases/tag/v0.1.0-preview.1)。安装包自带学习模型，使用无证书的 ad-hoc 签名，未经过 Apple 公证；首次打开可能被 macOS 阻止。源码与构建说明仍公开提供，官网尚未部署。开发者证书、公证和自动更新流程尚未建立；上游发布脚本仍不得直接用于本项目。
