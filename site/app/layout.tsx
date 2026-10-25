import type { Metadata, Viewport } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

const DESCRIPTION =
  "随声练是一款开源的 Mac 歌唱练习工具。它从正在播放的音乐中学习歌手旋律，并在你演唱时显示音高参考。音乐只在播放时分析，不会保存。";

export const metadata: Metadata = {
  title: { default: "随声练：跟着喜欢的歌练音准", template: "%s · 随声练" },
  description: DESCRIPTION,
  applicationName: "随声练",
  openGraph: { title: "随声练", description: DESCRIPTION, siteName: "随声练", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07080c" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6fb" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2">
          跳转到正文
        </a>
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
