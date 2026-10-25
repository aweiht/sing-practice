"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Cover from "@/components/Cover";
import DeleteButton from "@/components/DeleteButton";
import Heart, { HEART } from "@/components/Heart";
import { Logo, Nav } from "@/components/Nav";
import LearnBar from "@/components/LearnBar";
import StarterSongs, { useStartersHidden } from "@/components/StarterSongs";
import { firstPlayGoing, forgetSong, getLibrary, stopLearning, learnLabel, learnNow, live, type LearnJob, type LibrarySong, nowLocal, openInApp, playTrack, setFavorite, useSession } from "@/lib/session";

type Filter = "all" | "favorites" | "unscored" | "partial";
const FILTER_KEY = "onkey.libraryFilter";
type Sort = "recent" | "easy" | "hard" | "best" | "most" | "az";
const SORTS: [Sort, string][] = [["recent", "最近活动"], ["easy", "由易到难"], ["hard", "由难到易"],
                                 ["best", "最高分优先"], ["most", "演唱次数优先"], ["az", "按歌名排序"]];
const SORT_KEY = "onkey.librarySort";
const LEVELS_KEY = "onkey.libraryLevels";
const byName = (a: LibrarySong, b: LibrarySong) => a.track.name.localeCompare(b.track.name);
/** Songs in `sort` order; `shown` comes in recent order (or hearted order for Favourites), kept for ties. */
function sorted(songs: LibrarySong[], sort: Sort): LibrarySong[] {
  const s = [...songs];
  const d = (x: LibrarySong) => x.difficulty ?? null;
  switch (sort) {
    case "easy": return s.sort((a, b) => (d(a) ?? 9) - (d(b) ?? 9));
    case "hard": return s.sort((a, b) => (d(b) ?? 0) - (d(a) ?? 0));
    case "best": return s.sort((a, b) => (b.best ?? -1) - (a.best ?? -1));
    case "most": return s.sort((a, b) => (b.takes ?? 0) - (a.takes ?? 0));
    case "az": return s.sort(byName);
    default: return s;
  }
}

// Songs OnKey has learned. Click one to play it in its app (Spotify or Apple Music) and sing it with the notes ahead.
export default function Library() {
  const [songs, setSongs] = useState<LibrarySong[] | null>(null);
  const [q, setQ] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [startersHidden, hideStarters] = useStartersHidden();
  // All or Favourites, remembered between visits
  const [filter, setFilterState] = useState<Filter>("all");
  // the difficulty levels picked (none: every song) and the order, remembered too
  const [levels, setLevelsState] = useState<number[]>([]);
  const [sort, setSortState] = useState<Sort>("recent");
  useEffect(() => {
    try {
      const f = localStorage.getItem(FILTER_KEY);
      if (f === "favorites" || f === "unscored" || f === "partial") setFilterState(f);
      const l = JSON.parse(localStorage.getItem(LEVELS_KEY) ?? "[]");
      if (Array.isArray(l)) setLevelsState(l.filter(n => [1, 2, 3, 4, 5].includes(n)));
      const o = localStorage.getItem(SORT_KEY);
      if (SORTS.some(([k]) => k === o)) setSortState(o as Sort);
    } catch {}
  }, []);
  const setFilter = (f: Filter) => { setFilterState(f); try { localStorage.setItem(FILTER_KEY, f); } catch {} };
  const setLevels = (l: number[]) => { setLevelsState(l); try { localStorage.setItem(LEVELS_KEY, JSON.stringify(l)); } catch {} };
  const toggleLevel = (n: number) => setLevels(levels.includes(n) ? levels.filter(x => x !== n) : [...levels, n].sort());
  const setSort = (o: Sort) => { setSortState(o); try { localStorage.setItem(SORT_KEY, o); } catch {} };
  // hearts given on this page (over the library as loaded): on, and when
  const [hearts, setHearts] = useState<Map<string, string | null>>(new Map());
  function heart(s: LibrarySong, on: boolean) {
    setHearts(h => new Map(h).set(s.track.id, on ? nowLocal() : null));
    void setFavorite(s.track, on);
  }
  async function forget(id: string) {
    await forgetSong(id);
    setSongs(s => (s ?? []).filter(x => x.track.id !== id));
  }
  // a song being learned (a video that isn't a song, say): its learning stops and it's deleted
  async function stop(t: LibrarySong["track"]) {
    await stopLearning(t);
    setSongs(s => (s ?? []).filter(x => x.track.id !== t.id));
  }
  // songs being learned right now show here too: the one playing, and any still finishing after their play
  useEffect(() => { live.start(); }, []);
  const { song, takes, learning: jobs } = useSession();
  // newest activity first (top left): the song learning as it plays, then those finishing (the latest first), then
  // the library, the last played or learned first
  const learning = useMemo(() => {
    const m = new Map<string, { track: LibrarySong["track"] }>();
    if (song && firstPlayGoing(song, takes, song.track)) m.set(song.track.id, { track: song.track });
    for (const j of [...jobs].reverse()) if (!m.has(j.track_id))
      m.set(j.track_id, { track: { id: j.track_id, name: j.name, artist: j.artist, album: "", duration: 0 } });
    for (const t of [...takes].reverse()) if (t.status === "learning" && t.track_id && !m.has(t.track_id))
      m.set(t.track_id, { track: { id: t.track_id, name: t.name, artist: t.artist, album: "", duration: 0 } });
    return m;
  }, [song, takes, jobs]);
  // a song being learned (playing for the first time, or its learning still going) can't be started until it's done
  const learnFor = (t: LibrarySong["track"]): LearnJob | null =>
    learnNow(jobs, takes, song, t);   // (as useLearn)
  const settled = takes.filter(t => t.status !== "learning" && t.status !== "scoring").length;
  useEffect(() => { getLibrary().then(r => setSongs(r.filter(s => s?.track?.id))).catch(() => setSongs([])); }, [settled]);
  const all = useMemo(() => {
    if (songs === null) return null;
    const byId = new Map(songs.map(s => [s.track.id, s]));
    const now: LibrarySong[] = [...learning.values()]
      .map(l => byId.get(l.track.id) ?? { track: l.track, learned: null, fraction: 0, ready: false, best: null });
    return [...now, ...songs.filter(s => !learning.has(s.track.id))];
  }, [songs, learning]);
  // each song's heart: as hearted here, else as loaded
  const withHearts = useMemo(() => (all ?? []).map(s => hearts.has(s.track.id)
    ? { ...s, favorite: hearts.get(s.track.id) != null, favorited_at: hearts.get(s.track.id) ?? s.favorited_at } : s), [all, hearts]);
  // the list shows songs ready to sing (and any being learned now); ones only partly learned wait under "Partly
  // learned": they finish learning the next time they play, so there's nothing to sing from them yet
  const partly = (s: LibrarySong) => !s.ready && !learning.has(s.track.id);
  const main = useMemo(() => withHearts.filter(s => !partly(s)), [withHearts, learning]); // eslint-disable-line
  const favCount = withHearts.filter(s => s.favorite).length;
  const unscoredCount = main.filter(s => s.best == null).length;
  const partlyCount = withHearts.length - main.length;
  // songs at each difficulty level, for the level buttons
  const perLevel = useMemo(() => [1, 2, 3, 4, 5].map(n => main.filter(s => s.difficulty === n).length), [main]);
  // Favourites: the most recently hearted first (when sorted by Recent)
  const shown = useMemo(() => {
    let match = (filter === "partial" ? withHearts.filter(partly) : filter === "favorites" ? withHearts : main)
      .filter(s => `${s.track.name} ${s.track.artist}`.toLowerCase().includes(q.trim().toLowerCase()));
    if (levels.length) match = match.filter(s => s.difficulty != null && levels.includes(s.difficulty));
    if (filter === "unscored") match = match.filter(s => s.best == null);
    if (filter === "favorites")
      match = match.filter(s => s.favorite).sort((a, b) => (b.favorited_at ?? "").localeCompare(a.favorited_at ?? ""));
    return sorted(match, sort);
  }, [withHearts, main, q, filter, levels, sort]); // eslint-disable-line
  const narrowed = levels.length > 0 || q.trim() !== "";

  async function sing(s: LibrarySong) {
    setStarting(s.track.id);
    try { await playTrack(s.track.id, true, s.track.name); }     // or, in listening mode without control, the prompt shows
    catch {}
    finally { setStarting(null); }
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      <header data-tauri-drag-region className="app-header flex items-center gap-5 px-6 pt-4 pb-3"><Logo /><Nav /></header>
      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-6 mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">歌曲库</h1>
            <p className="mt-1 text-ink-300">随声练已学习的歌曲。选择一首歌进行引导演唱，音符会提前显示。</p>
          </div>
          {all && all.length > 0 && (
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索歌曲"
                   className="w-64 rounded-xl border border-white/8 bg-white/4 px-3.5 py-2 text-sm text-ink-100 placeholder:text-ink-400 outline-none transition focus:border-accent-400/50 focus:bg-white/6" />
          )}
        </div>

        {all === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="glass h-36 rounded-3xl shimmer" />)}</div>
        ) : all.length === 0 ? (
          <div className={`glass rounded-3xl px-6 text-center ${startersHidden === false ? "pt-16 pb-6" : "py-20"}`}>
            <h2 className="text-xl font-semibold">还没有学会歌曲</h2>
            <p className="mx-auto mt-1 max-w-md text-ink-300">保持随声练开启并完整播放一首歌，应用就会学习它的旋律。也可以播放整个歌单。</p>
            <Link href="/" className="mt-5 inline-block rounded-xl bg-accent-500 px-4 py-2 font-medium text-white transition hover:bg-accent-400">开始</Link>
            {startersHidden === false && <StarterSongs onHide={() => hideStarters(true)} className="mx-auto mt-12 max-w-4xl" />}
            {startersHidden && <button onClick={() => hideStarters(false)} className="mt-4 block w-full text-xs text-ink-500 transition hover:text-ink-200">显示推荐练习歌曲</button>}
          </div>
        ) : (<>
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div role="radiogroup" aria-label="歌曲筛选" className="inline-flex rounded-full border border-white/8 bg-white/4 p-1 text-sm">
            {([["all", "全部", main.length], ["favorites", "已收藏", favCount], ["unscored", "未评分", unscoredCount],
               ...(partlyCount ? [["partial", "部分学完", partlyCount]] as const : [])] as const).map(([f, label, n]) => (
              <button key={f} role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} title={`${n} 首歌`}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 outline-none transition focus-visible:ring-2 focus-visible:ring-accent-400/60
                                  ${filter === f ? "bg-white/10 text-white" : "text-ink-300 hover:text-white"}`}>
                {f === "favorites" && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden
                                           className={filter === f ? "text-accent-400" : ""}><path d={HEART} /></svg>}
                {label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="难度筛选" className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/4 p-1 text-sm">
            <span className="px-2 text-xs text-ink-400">难度</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} aria-pressed={levels.includes(n)} onClick={() => toggleLevel(n)}
                      title={`${LEVELS[n - 1]}：${perLevel[n - 1]} 首歌`}
                      aria-label={`${LEVELS[n - 1]}（共 5 级，第 ${n} 级）`}
                      className={`group flex h-8 items-center gap-0.5 rounded-full px-2.5 outline-none transition focus-visible:ring-2 focus-visible:ring-accent-400/60
                                  ${levels.includes(n) ? "bg-white/10" : "hover:bg-white/5"}`}>
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-full transition ${i > n ? "bg-ink-700"
                    : levels.includes(n) ? "bg-white" : "bg-ink-300 group-hover:bg-ink-100"}`} />
                ))}
              </button>
            ))}
            {levels.length > 0 && <button onClick={() => setLevels([])} className="px-2 text-xs text-ink-400 transition hover:text-white">清除</button>}
          </div>
          <SortMenu sort={sort} onSort={setSort} />
          <span className="tabular text-sm text-ink-500">{shown.length} 首歌</span>
          </div>
          {filter === "partial" && partlyCount > 0 && (
            <div className="-mt-1 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-sm text-ink-400">
              <p>随声练只听到了其中一部分。完整播放一次即可完成学习，之后会移到“全部”中。</p>
              <ClearPartly songs={shown.filter(x => !x.favorite)} hearted={shown.filter(x => x.favorite).length} narrowed={narrowed} onDelete={forget} />
            </div>
          )}
          {filter === "favorites" && favCount === 0 ? (
            <div className="glass rounded-3xl px-6 py-16 text-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="mx-auto mb-3 text-accent-400"><path d={HEART} /></svg>
              <p className="text-ink-200">点击歌曲旁的 ♥ 即可收藏。</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="px-1 py-10 text-center text-ink-400">
              {filter === "partial" && !narrowed ? "没有只学了一部分的歌曲；所有歌曲都已准备就绪。" : filter === "unscored" && !narrowed ? "所有歌曲都已评分。" : q.trim() ? <>没有匹配“{q.trim()}”的歌曲。</> : "没有符合这些筛选条件的歌曲。"}
              {narrowed && <button onClick={() => { setQ(""); setLevels([]); }} className="ml-2 text-accent-300 underline-offset-2 hover:underline">清除筛选</button>}
            </p>
          ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map(s => { const job = learnFor(s.track); return (
              <div key={s.track.id} role="button" tabIndex={0} aria-disabled={!!job || undefined}
                   title={job ? "学习完成后即可演唱" : undefined}
                   onClick={() => !job && !starting && sing(s)}
                   onKeyDown={e => { if (e.key === "Enter" && !job && !starting) sing(s); }}
                   className={`glass group relative overflow-hidden rounded-3xl p-4 text-left transition
                               ${job ? "cursor-default" : "cursor-pointer hover:-translate-y-0.5 hover:border-accent-400/35"} ${starting ? "opacity-60" : ""}`}>
                <span className="absolute top-3 right-3 z-10 flex items-center" onClick={e => e.stopPropagation()}>
                  <Heart on={!!s.favorite} onToggle={on => heart(s, on)} subtle />
                  {!job && !learning.has(s.track.id) ? (
                    <DeleteButton what="删除这首歌（练习记录会保留在“演唱记录”中；歌曲将移到废纸篓）" confirm="确定删除这首歌吗？"
                                  onDelete={() => forget(s.track.id)} />
                  ) : (
                    <DeleteButton what="停止学习并删除这首歌（例如确认它并非歌曲）" confirm="确定停止学习并删除吗？"
                                  onDelete={() => stop(s.track)} />
                  )}
                </span>
                <div className="flex items-start gap-3.5">
                  <Cover name={s.track.name} art={s.track.art} link={s.track.link} />
                  <div className="min-w-0 flex-1 pr-14">
                    <div className="truncate font-medium">{s.track.name}</div>
                    <div className="truncate text-sm text-ink-400">{s.track.artist}</div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {job
                        ? <span className="flex items-center gap-1.5 rounded-full bg-accent-500/12 px-2 py-0.5 font-medium text-accent-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />正在学习</span>
                        : s.ready
                        ? <span className="rounded-full bg-good/12 px-2 py-0.5 font-medium text-good">已准备就绪</span>
                        : <span className="rounded-full bg-close/12 px-2 py-0.5 font-medium text-close">已学习 {Math.round(100 * s.fraction)}%</span>}
                      {s.difficulty != null && <Difficulty level={s.difficulty} />}
                      {s.best != null && <span className="text-ink-400">最高分 <span className="tabular font-semibold text-ink-100">{s.best}</span></span>}
                      {s.app && !job && (
                        <button onClick={e => { e.stopPropagation(); void openInApp(s.track.id); }} onKeyDown={e => e.stopPropagation()}
                                title={`在 ${s.app} 中打开`} className="truncate text-ink-500 underline-offset-2 transition hover:text-ink-200 hover:underline">
                          在 {s.app} 中打开 ↗</button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4 text-sm">
                  {job ? <LearnBar job={job} showPct={false} className="min-w-0 flex-1" />
                       : <span className="text-ink-400">{s.ready ? "音符会提前显示" : "完整播放以完成学习"}</span>}
                  {job ? (
                    <span className="tabular shrink-0 font-medium text-ink-400">{learnLabel(job)}</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 font-medium text-accent-300 transition group-hover:text-white">
                      {starting === s.track.id ? "正在启动…" : "演唱"}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5z" /></svg>
                    </span>
                  )}
                </div>
              </div>
            ); })}
          </div>
          )}
          {/* songs to try, always reachable (collapsed to a link once hidden) */}
          <div className="mt-12">
            {startersHidden === false && <StarterSongs onHide={() => hideStarters(true)} className="mx-auto max-w-4xl" />}
            {startersHidden && <button onClick={() => hideStarters(false)} className="block w-full text-center text-xs text-ink-500 transition hover:text-ink-200">推荐练习歌曲</button>}
          </div>
        </>)}
        <p className="mt-12 max-w-2xl text-xs leading-relaxed text-ink-500">
          随声练不会保存音乐，只保留学习到的音符和你的演唱录音。歌词来自{" "}
          <a href="https://lrclib.net" target="_blank" rel="noreferrer" className="underline decoration-ink-600 underline-offset-2 hover:text-ink-300">LRCLIB</a>.
          随声练与 Spotify、Apple 或 Google 均无关联，也未获其认可；这些名称均为其各自所有者的商标。
        </p>
      </main>
    </div>
  );
}

const LEVELS = ["简单", "较简单", "中等", "困难", "很难"];

/** How hard a song is to sing, as 1-5 dots (store::difficulty): mostly the range of its melody. */
function Difficulty({ level }: { level: number }) {
  const word = LEVELS[level - 1] ?? "";
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`难度 ${level}/5：${word}`}
          title={`难度 ${level}/5：${word}。主要根据旋律音域跨度判断。`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "bg-ink-300" : "bg-ink-700"}`} />
      ))}
    </span>
  );
}

/** The order, as a pill like the filters beside it, opening a small menu. */
function SortMenu({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const label = SORTS.find(([k]) => k === sort)?.[1] ?? "最近活动";
  return (
    <div ref={ref} className="relative ml-auto">
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
              className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 py-2 pr-3 pl-4 text-sm text-ink-300 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-accent-400/60">
        <span className="text-ink-400">排序</span><span className="text-ink-100">{label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden
             className={`text-ink-400 transition ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/98 p-1 shadow-xl shadow-black/50">
          {SORTS.map(([k, l]) => (
            <button key={k} role="menuitemradio" aria-checked={sort === k} onClick={() => { onSort(k); setOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/6 ${sort === k ? "text-white" : "text-ink-300"}`}>
              {l}{sort === k && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="text-accent-400"><path d="M5 12l5 5 9-10" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Partly learned tab's "Delete all": every song shown there (not hearted ones), after asking. Each goes to the
 *  Trash as one deleted from its card does; takes stay in History. */
function ClearPartly({ songs, hearted, narrowed, onDelete }: { songs: LibrarySong[]; hearted: number; narrowed: boolean; onDelete: (id: string) => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (songs.length === 0) return null;
  const n = songs.length, what = `${narrowed ? "当前显示的 " : ""}${n} 首部分学完的歌曲`;
  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className="shrink-0 text-ink-400 underline-offset-2 transition hover:text-white hover:underline">
        全部删除（{n}）
      </button>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-3" role="group" aria-label="删除所有部分学完的歌曲">
      <span className="text-ink-200">删除{what}吗？练习记录会保留在“演唱记录”中{hearted ? `；已收藏的 ${hearted} 首歌曲会保留` : ""}。</span>
      <button disabled={busy} onClick={async () => { setBusy(true); for (const x of songs) await onDelete(x.track.id); setBusy(false); setAsking(false); }}
              className="rounded-lg bg-red-500/80 px-3 py-1 font-medium text-white transition hover:bg-red-500 disabled:opacity-60">
        {busy ? "正在删除…" : "全部删除"}
      </button>
      <button disabled={busy} onClick={() => setAsking(false)} className="text-ink-400 transition hover:text-white">取消</button>
    </span>
  );
}
