# 发布说明（上游历史参考）

> **重要：本文仅用于说明上游 OnKey 的历史发布流程，不适用于随声练，不能直接执行其中的脚本、命令、密钥路径或发布步骤。**
>
> 本项目目前没有中文版发布安装包、自动更新配置、自有 Apple Developer ID 签名、公证材料或上游发布凭据。不得将上游发布流程用于本仓库。

## 上游流程摘要

原始文件来自 Daniel Murrell 的 [dsmurrell/onkey](https://github.com/dsmurrell/onkey)，描述其 OnKey 版本如何构建带模型的 Mac 安装包、签名和公证、生成更新文件、校验 SHA-256，再创建 GitHub Release。上游流程依赖其专属签名、更新密钥、Apple 配置和发布脚本。

其中出现的 `scripts/release.sh`、`scripts/make-dmg.sh`、`scripts/check-release.sh`、`scripts/check-dmg.sh`、更新密钥和 GitHub Release 地址都属于上游历史内容。随声练没有对应的签名身份、更新密钥或正式发布流程；自动更新也已关闭。

## 随声练当前状态

本仓库仅提供公开源码和本地构建说明。源码构建不等于正式发布；当前没有安装包下载，也没有部署官网。未来若要建立本项目的发布流程，必须先由维护者制定并审查独立的版本、签名、公证、更新与验证流程，再另行更新本文件。本文本身不构成操作授权或发布步骤。
