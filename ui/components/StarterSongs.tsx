"use client";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { sizedArt, spotifySearch } from "@/components/Cover";
import { getSettings, inApp, openLink, setSetting } from "@/lib/session";

/** The starter playlist, public, for the first card ("播放随声练歌单"). Paste its share link
 *  here: a Spotify playlist (https://open.spotify.com/playlist/<id>) and/or an Apple Music one
 *  (https://music.apple.com/...). While both are "" the card is hidden. Set, the card's button opens it in the
 *  Spotify app (or Apple Music). */
export const STARTER_PLAYLIST_URL: string = "https://open.spotify.com/playlist/3Anv0qIDPKoitFPK71u7Bd";
export const STARTER_PLAYLIST_APPLE_URL: string = "";

/** Songs that are good to start with, picked from the upstream evaluation set (a clean lead vocal, a steady melody, well
 *  known; easy to hard). Titles, artists and a reason only: no lyrics, audio or covers bundled (a cover is looked
 *  up on Apple's iTunes Search once and kept in the app's data folder: music.rs starter_cover). */
export const STARTER_SONGS: { artist: string; title: string; why: string }[] = [
  { artist: "Ben E. King", title: "Stand By Me", why: "入门：旋律平稳、简单" },
  { artist: "Oasis", title: "Wonderwall", why: "适合跟唱，很多人熟悉" },
  { artist: "Tracy Chapman", title: "Fast Car", why: "音域偏低、节奏平稳" },
  { artist: "Lana Del Rey", title: "Young And Beautiful", why: "长音较多，适合练习保持音高" },
  { artist: "Lewis Capaldi", title: "Someone You Loved", why: "主歌舒缓，副歌起伏较大" },
  { artist: "Adele", title: "Someone Like You", why: "人声清晰，副歌逐渐上扬" },
  { artist: "Jeff Buckley", title: "Hallelujah", why: "节奏舒缓、表现力强，适合练音准" },
  { artist: "Whitney Houston", title: "I Will Always Love You", why: "进阶挑战：音域跨度大" },
];

/** Apple Music's search for a song (a plain link to music.apple.com, no API; it goes to your own storefront). */
const appleSearch = (artist: string, title: string) =>
  `https://music.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}`;

const HIDE_KEY = "onkey.hideStarters";   // outside the app (the browser preview), where there are no settings

/** Whether the suggestions are hidden ("隐藏推荐歌曲", kept in Settings), null until known, and a setter. */
export function useStartersHidden(): [boolean | null, (hide: boolean) => void] {
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    if (!inApp()) { try { setHidden(localStorage.getItem(HIDE_KEY) === "1"); } catch { setHidden(false); } return; }
    getSettings().then(s => setHidden(!!s?.hide_starters)).catch(() => setHidden(false));
  }, []);
  const set = (hide: boolean) => {
    setHidden(hide);
    if (inApp()) void setSetting("hide_starters", hide);
    else try { localStorage.setItem(HIDE_KEY, hide ? "1" : "0"); } catch {}
  };
  return [hidden, set];
}

const open = (href: string) => (e: SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); void openLink(href); };

function Out({ href, label, dim, title }: { href: string; label: string; dim?: boolean; title?: string }) {
  return (
    <a href={href} onClick={open(href)} title={title ?? `在 ${label} 中搜索这首歌`}
       className={`shrink-0 whitespace-nowrap underline-offset-2 transition hover:underline ${dim ? "text-ink-500 hover:text-ink-300" : "text-ink-400 hover:text-ink-200"}`}>{label} ↗</a>
  );
}

type StarterCover = { art: string; link: string | null };
/** Covers found this session (null: none found), so coming back to the page asks the app again for nothing. */
const covers = new Map<string, StarterCover | null>();
const songKey = (s: { artist: string; title: string }) => `${s.artist}\n${s.title}`;

/** The starter songs' covers, asked for one at a time (the app keeps them; the first time, it looks each up,
 *  spaced). Only in the app: the browser preview shows the drawn tiles. */
function useStarterCovers(): Map<string, StarterCover | null> {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!inApp()) return;
    let live = true;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      for (const s of STARTER_SONGS) {
        if (!live) return;
        if (covers.has(songKey(s))) continue;
        const c = await invoke<StarterCover | null>("starter_cover", { artist: s.artist, title: s.title }).catch(() => undefined);
        if (c === undefined) continue;   // asked again next time
        covers.set(songKey(s), c);
        if (live) redraw(n => n + 1);
      }
    })();
    return () => { live = false; };
  }, []);
  return covers;
}

/** No cover (offline, not found, or outside the app): a tile coloured from the title with a little melody drawn in
 *  the lane's style (rounded note bars stepping up and down), different for every song. Drawn here: no one's art. */
function StarterTile({ title, size }: { title: string; size: number }) {
  let h = 7;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  let seed = h || 1;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) / 0x1000000; };
  const bars: { x: number; y: number; w: number }[] = [];
  let x = 5, y = 16 + Math.round(rnd() * 12);
  while (x < 36) {
    const w = Math.min(39 - x, 3 + Math.round(rnd() * 5));
    if (w >= 3) bars.push({ x, y, w });
    x += w + 1.5;
    const step = (rnd() < 0.5 ? -1 : 1) * (3 + Math.round(rnd() * 5));
    y = y + step < 9 || y + step > 35 ? y - step : y + step;
  }
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} aria-hidden className="shrink-0 shadow-lg shadow-black/30"
         style={{ borderRadius: Math.round(size * 0.28) }}>
      <defs>
        <linearGradient id={`starter-${h}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 55% 36%)`} /><stop offset="1" stopColor={`hsl(${(hue + 40) % 360} 50% 15%)`} />
        </linearGradient>
      </defs>
      <rect width="44" height="44" fill={`url(#starter-${h})`} />
      {[14, 22, 30].map(r => <rect key={r} x="0" y={r} width="44" height="0.6" fill="rgba(255,255,255,.08)" />)}
      {bars.map((b, i) => <rect key={i} x={b.x} y={b.y - 2.25} width={b.w} height="4.5" rx="2.25" fill={`hsl(${hue} 90% 87%)`} opacity={0.9} />)}
    </svg>
  );
}

/** A starter song's cover, linked to the song on Apple Music (as Apple's artwork terms ask), or the drawn tile. */
function StarterArt({ title, artist, cover, size = 44 }: { title: string; artist: string; cover?: StarterCover | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!cover || failed) return <StarterTile title={title} size={size} />;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cover.art.startsWith("data:") ? cover.art : sizedArt(cover.art, size * 2)} alt="" width={size} height={size}
         onError={() => setFailed(true)} className="block shrink-0 object-cover shadow-lg shadow-black/30 ring-1 ring-white/8"
         style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }} />
  );
  if (!cover.link) return img;
  return (
    <a href={cover.link} onClick={open(cover.link)} title="在 Apple Music 中打开" aria-label={`在 Apple Music 中打开《${title}》— ${artist}`}
       className="shrink-0 transition hover:opacity-85">{img}</a>
  );
}

/** "Play the starter playlist": opens it in the Spotify app (or Apple Music), where the app hears it. (Not
 *  the services' embedded players: those played inside OnKey's own window, which OnKey doesn't listen to.) */
function PlaylistStrip() {
  const href = STARTER_PLAYLIST_URL || STARTER_PLAYLIST_APPLE_URL;
  const app = STARTER_PLAYLIST_URL ? "Spotify" : "Apple Music";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-accent-400/25 bg-accent-500/10 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink-100">播放随声练推荐歌单</span>
        <span className="block text-xs text-ink-300">包含这些歌曲及更多曲目，难度由易到难：点击播放并开始演唱</span>
      </span>
      {STARTER_PLAYLIST_URL && STARTER_PLAYLIST_APPLE_URL && (
        <Out href={STARTER_PLAYLIST_APPLE_URL} label="或在 Apple Music 中打开" dim title="在 Apple Music 中打开歌单" />
      )}
      <a href={href} onClick={open(href)} title={`在 ${app} 中打开歌单`}
         className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent-500 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-accent-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l13-7.5z" /></svg>
        在 {app} 中播放
      </a>
    </div>
  );
}

export default function StarterSongs({ onHide, className = "", hideLabel = "隐藏推荐歌曲" }: { onHide: () => void; className?: string; hideLabel?: string }) {
  const playlist = !!(STARTER_PLAYLIST_URL || STARTER_PLAYLIST_APPLE_URL);
  const found = useStarterCovers();
  return (
    <section aria-label="推荐歌曲" className={`w-full text-left ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1 text-xs">
        <span className="font-medium text-ink-300">试试这些歌曲 <span className="font-normal text-ink-500">· 随声练能较好跟随的歌曲</span></span>
        <button onClick={onHide} className="text-ink-500 transition hover:text-ink-200">{hideLabel}</button>
      </div>
      <ul className="flex snap-x gap-2 overflow-x-auto pr-8 pb-2 [scrollbar-width:thin] [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]">
        {STARTER_SONGS.map(s => {
          const cover = found.get(songKey(s));
          return (
            <li key={songKey(s)} className="glass flex w-48 shrink-0 snap-start flex-col rounded-2xl p-3">
              <span className="flex items-center gap-2.5">
                <StarterArt title={s.title} artist={s.artist} cover={cover} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-ink-100" title={s.title}>{s.title}</span>
                  <span className="truncate text-xs text-ink-400" title={s.artist}>{s.artist}</span>
                </span>
              </span>
              <span className="mt-2 flex-1 text-xs leading-snug text-ink-300">{s.why}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
                <span className="shrink-0 whitespace-nowrap text-ink-500">平台</span><Out href={spotifySearch(s.artist, s.title)} label="Spotify" />
                <span className="shrink-0 text-ink-600">·</span>
                {cover?.link ? <Out href={cover.link} label="Apple Music" dim title="在 Apple Music 中打开这首歌" />
                  : <Out href={appleSearch(s.artist, s.title)} label="Apple Music" dim />}
              </span>
            </li>
          );
        })}
      </ul>
      {playlist && <PlaylistStrip />}
    </section>
  );
}

/** The songs to try over the Sing page (the logo, clicked on Sing, opens it: "onkey-songs-to-try"), even mid-song,
 *  without leaving the lane; Esc or a click outside closes it. */
export function StarterSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("onkey-songs-to-try", show);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("onkey-songs-to-try", show); window.removeEventListener("keydown", key); };
  }, []);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="推荐练习歌曲" onClick={() => setOpen(false)}
         className="fixed inset-0 z-40 grid place-items-start overflow-y-auto bg-ink-950/70 px-4 pt-24 pb-10 backdrop-blur-sm animate-rise">
      <div onClick={e => e.stopPropagation()} className="glass mx-auto w-full max-w-4xl rounded-3xl p-5">
        <StarterSongs onHide={() => setOpen(false)} hideLabel="关闭" />
      </div>
    </div>
  );
}
