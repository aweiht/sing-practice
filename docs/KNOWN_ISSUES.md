# 已知问题 / Known issues

以下问题尚未修复。使用建议只用于降低影响，不能替代修复。

## 已知问题

### 删除操作可能绕过废纸篓

如果应用无法把练习记录或歌曲数据移入 macOS 废纸篓，当前删除逻辑会直接删除文件或目录。重要数据请在删除前自行备份；这类删除不一定能从废纸篓恢复。该处理逻辑尚未修复。

### 历史记录或歌曲库读取失败时可能显示为空

本地读取错误可能被页面当作空结果处理。看到空列表时，数据可能只是暂时无法读取，并不一定已经删除。可重新打开应用再检查；在确认数据状态前，避免进一步清理相关文件。错误状态的显示逻辑尚未修复。

### 删除失败后确认按钮可能保持禁用

删除操作失败后，确认按钮的忙碌状态可能没有复位。重新打开应用页面会重置按钮状态；再次操作前先检查条目是否仍存在。页面重开不会重试之前的请求，也不能恢复已删除的数据。该状态处理尚未修复。

### 内容安全策略的纵深限制尚不完整

当前应用的内容安全策略没有为默认资源和脚本来源设置完整限制。现有审查未发现用户输入进入危险 HTML 的路径，因此这不是已证实的注入漏洞；它会削弱对未来注入缺陷的纵深防护。策略尚未收紧。

### 桌面界面与网站构建依赖仍有 PostCSS 安全公告

桌面界面与网站的构建依赖均锁定 Next.js 15.5.28；该版本自身的公告已从审计结果中消失，但两者的嵌套依赖仍包含 PostCSS 8.4.31。两份 `npm audit` 均将 PostCSS 项目标为高危，并因该传递依赖将 Next.js 标为中危，报告的公告包括 [`GHSA-qx2v-qp2m-jg93`](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)、[`GHSA-6g55-p6wh-862q`](https://github.com/advisories/GHSA-6g55-p6wh-862q)、[`GHSA-fxqj-rqcc-2cmp`](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)、[`GHSA-r28c-9q8g-f849`](https://github.com/advisories/GHSA-r28c-9q8g-f849)。网站使用静态导出；桌面界面在运行时也不启动 Next.js 服务端。本次审查未确认桌面运行时或网站生成页面存在可利用路径。公告仍存在于构建依赖树中。`npm audit` 建议升级到 Next.js 16.4.3，属于主版本升级，需要另行评估兼容性；目前未升级，也未添加依赖覆盖。

## 验证与发布边界

尚未对真实音乐输入进行端到端实测。Shazam 新歌识别能力尚未验证；本项目没有自有 Shazam Developer ID。中文歌词对齐能力尚未验证。当前提供 Apple Silicon 预览安装包，使用无证书 ad-hoc 签名，未经过 Apple 公证；首次打开可能被 macOS 阻止。

## Known issues

### Deletion can bypass the Trash

If the app cannot move practice records or song data to the macOS Trash, its current deletion path removes the files or folders directly. Back up important data before deleting it; such items may not be recoverable from the Trash. This behavior is not fixed.

### History or library read failures can look like empty lists

The pages can treat local read errors as empty results. An empty list may mean the data could not be read temporarily; it does not necessarily mean the data was deleted. Reopen the app and check again. Avoid further cleanup until the data state is clear. Error handling is not fixed.

### A failed deletion can leave its confirmation button disabled

After a deletion request fails, the confirmation button may remain busy and disabled. Reopening the app page resets the button state; first check whether the item still exists before trying again. Reopening does not retry the earlier request or restore deleted data. This state handling is not fixed.

### Content Security Policy defense in depth is incomplete

The app's Content Security Policy does not fully restrict default resource and script sources. The current review found no path from user input to a dangerous HTML sink, so this is not a confirmed injection vulnerability. The incomplete policy weakens defense in depth against a future injection flaw and has not been tightened.

### PostCSS advisories remain in the desktop UI and website build dependencies

The desktop UI and website build dependencies are both pinned to Next.js 15.5.28. Its own advisories no longer appear in the audits, but both nested dependency trees still contain PostCSS 8.4.31. Both `npm audit` runs mark PostCSS high severity and Next.js moderate severity via this dependency, reporting [`GHSA-qx2v-qp2m-jg93`](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [`GHSA-6g55-p6wh-862q`](https://github.com/advisories/GHSA-6g55-p6wh-862q), [`GHSA-fxqj-rqcc-2cmp`](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), and [`GHSA-r28c-9q8g-f849`](https://github.com/advisories/GHSA-r28c-9q8g-f849). The website uses static export, and the desktop UI does not run a Next.js server at runtime. This review did not confirm an exploitable path in the desktop runtime or generated website pages. The advisories remain in the build dependency trees. `npm audit` recommends Next.js 16.4.3, a major-version upgrade that needs a separate compatibility review; it has not been applied, and no dependency override was added.

## Validation and release limits

End-to-end operation with real music input is unverified. Shazam song recognition is unverified; this project has no project-owned Shazam Developer ID. Chinese lyric alignment is unverified. An Apple Silicon preview installer is available with an ad-hoc signature and no Apple notarisation; macOS may block its first launch.
