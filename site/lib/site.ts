// 随声练网站使用的项目地址和基础事实。
export const GITHUB_URL = "https://github.com/aweiht/sing-practice";
export const RELEASE_URL = `${GITHUB_URL}/releases/tag/v0.1.0-preview.1`;
export const INSTALLER_URL = `${GITHUB_URL}/releases/download/v0.1.0-preview.1/sing-practice-0.1.0-preview.1-macos-arm64.dmg`;

// 当前尚未部署官网；此值暂记项目仓库地址，不作为已上线网站地址使用。
export const SITE_URL = GITHUB_URL;

// 随声练应用独立保存数据，不读取 OnKey 原版的数据目录。
export const DATA_DIR = "~/Library/Application Support/io.github.aweiht.sing-practice/";

export const REQUIREMENTS = ["搭载 Apple 芯片的 Mac（M1 或更新机型）", "macOS 14.2 或更新版本"];

export const NOT_AFFILIATED =
  "随声练与 Spotify、Apple 或 Google 均无关联，也未获其认可。这些名称是各自所有者的商标，仅用于说明兼容的应用。";

/** 返回项目仓库中对应文件的链接。 */
export const codeUrl = (path: string) => `${GITHUB_URL}/blob/HEAD/${path}`;

/** 未部署官网时，所有问题与反馈都通过项目 GitHub Issues 提交。 */
export const ISSUES_URL = `${GITHUB_URL}/issues`;
