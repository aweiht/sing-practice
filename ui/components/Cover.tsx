"use client";
import { useState, type SyntheticEvent } from "react";
import { openInApp, openLink } from "@/lib/session";

/** A song's album cover; a tile coloured from the song name when there's no cover (or it can't load). A cover
 *  from Apple (iTunes Search or Shazam) links to the song's Apple Music page (`link`), as Apple's terms ask. */
export default function Cover({ name, art, link, size = 56, eager = false }: { name: string; art?: string | null; link?: string | null; size?: number; eager?: boolean }) {
  // which cover failed to load (a new one, e.g. found after the song started, gets its own chance)
  const [failed, setFailed] = useState<string | null>(null);
  const radius = Math.round(size * 0.28);
  if (art && failed !== art) {
    const img = (
      // eager where it's always on screen (the Sing page's header): WebKit could leave a lazy cover there unloaded
      // eslint-disable-next-line @next/next/no-img-element
      <img key={art} src={sizedArt(art, size * 2)} alt="" width={size} height={size} loading={eager ? "eager" : "lazy"} decoding={eager ? "sync" : "async"} onError={() => setFailed(art)}
           className="shrink-0 object-cover shadow-lg shadow-black/30 ring-1 ring-white/8"
           style={{ width: size, height: size, borderRadius: radius }} />
    );
    if (!link) return img;
    // a span, not a button: covers sit inside cards that are themselves clickable
    const open = (e: SyntheticEvent) => { e.stopPropagation(); e.preventDefault(); void openLink(link); };
    return (
      <span role="link" tabIndex={0} title="在 Apple Music 中打开" aria-label={`在 Apple Music 中打开《${name}》`}
            onClick={open} onKeyDown={e => { if (e.key === "Enter") open(e); }}
            className="shrink-0 cursor-pointer transition hover:opacity-85" style={{ borderRadius: radius }}>
        {img}
      </span>
    );
  }
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <div className="grid shrink-0 place-items-center font-bold text-white/90 shadow-inner"
         style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.32,
                  background: `linear-gradient(135deg, hsl(${h} 70% 58%), hsl(${(h + 40) % 360} 65% 38%))` }}>
      {name.replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Apple's cover URLs name their size (".../800x800bb.jpg"): ask for the size shown, not 800 px to show at 40
 *  (less to fetch and decode; a big cover decoded late inside the header's entrance animation could stay unpainted). */
export const sizedArt = (art: string, px: number) =>
  art.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${Math.round(px)}x${Math.round(px)}bb.$1`);

/** Spotify's search for a song (a plain link, no API). */
export const spotifySearch = (artist: string, name: string) =>
  `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${name}`.trim())}`;

/** Where the song plays, as a link to it there: "in Spotify ↗" (muted, underlined on hover), then the other service
 *  as one dimmer link ("Apple Music ↗"). A service is never shown twice; a source that can't be linked (unknown) is
 *  a plain label. With `trackId`, "in Spotify ↗" opens the song as OnKey does everywhere (openInApp: by its id in
 *  that app when known). */
export function SourceLinks({ source, artist, name, appleLink, trackId }: { source: string; artist: string; name: string; appleLink?: string | null; trackId?: string }) {
  const spotify = spotifySearch(artist, name);
  const own = trackId && ["Spotify", "Apple Music", "YouTube"].includes(source) ? `#open-${trackId}`
    : source === "Spotify" ? spotify : source === "Apple Music" ? appleLink ?? null : null;
  const other = source === "Spotify" ? (appleLink ? { label: "Apple Music", href: appleLink } : null)
    : source === "Apple Music" ? { label: "Spotify", href: spotify }
    : appleLink ? { label: "Apple Music", href: appleLink } : null;
  const open = (href: string) => (e: SyntheticEvent) => {
    e.preventDefault(); e.stopPropagation();
    void (trackId && href === `#open-${trackId}` ? openInApp(trackId) : openLink(href));
  };
  return (
    <>
      {source && (own
        ? <a href={own} onClick={open(own)} title={`在 ${source} 中打开`} className="text-ink-500 underline-offset-2 transition hover:text-ink-200 hover:underline">在 {source} 中打开 ↗</a>
        : <span className="text-ink-500" title="随声练正在跟随的应用">在 {source} 中播放</span>)}
      {other && <>
        {source && <span className="text-ink-600">·</span>}
        <a href={other.href} onClick={open(other.href)} title={`在 ${other.label} 中打开`}
           className="text-ink-600 underline-offset-2 transition hover:text-ink-300 hover:underline">{other.label} ↗</a>
      </>}
    </>
  );
}

/** "Apple Music" as a small link to the song's page (shown with Shazam matches and Apple covers). */
export function AppleMusicLink({ link, className = "" }: { link?: string | null; className?: string }) {
  if (!link) return null;
  return (
    <a href={link} onClick={e => { e.preventDefault(); e.stopPropagation(); void openLink(link); }}
       className={`text-ink-400 underline decoration-ink-600 underline-offset-2 transition hover:text-white ${className}`}>
      在 Apple Music 中打开 ↗
    </a>
  );
}
