/** 保留文件路径以减少上游结构差异；随声练网站不加载访问路径追踪代码。 */
export const FM_EVENTS = {} as const;
export function fm() {}
export function isLiveSite() { return false; }
export function labelVisit() {}
export function newPageView() {}
export function resumeIfIdle() {}
