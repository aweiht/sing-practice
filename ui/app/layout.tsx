import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ControlPrompt from "@/components/ControlPrompt";
import ReportProblem from "@/components/ReportProblem";
import MirrorBadge from "@/components/MirrorBadge";
import GoHome from "@/components/GoHome";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "随声练",
  description: "跟着正在播放的歌曲练习演唱，记录每次练习的音准表现。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script dangerouslySetInnerHTML={{ __html: "if ('__TAURI_INTERNALS__' in window) { document.documentElement.classList.add('in-app'); const log = m => { try { window.__TAURI_INTERNALS__.invoke('ui_log', { msg: String(m).slice(0, 2000) }); } catch (e) {} }; window.addEventListener('error', e => log(e.message + ' at ' + e.filename + ':' + e.lineno)); window.addEventListener('unhandledrejection', e => log('unhandled: ' + (e.reason && (e.reason.stack || e.reason)))); const ce = console.error; console.error = (...a) => { log(a.join(' ')); ce(...a); }; }" }} />
        {children}
        <ControlPrompt />
        <ReportProblem />
        <MirrorBadge />
        <GoHome />
      </body>
    </html>
  );
}
