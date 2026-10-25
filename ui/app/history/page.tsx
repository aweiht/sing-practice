"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Cover from "@/components/Cover";
import DeleteButton from "@/components/DeleteButton";
import Heart from "@/components/Heart";
import { Logo, Nav } from "@/components/Nav";
import LearnBar from "@/components/LearnBar";
import { deleteTake, getLibrary, getTakes, learnLabel, learnOf, live, playTrack, setFavorite, useLearn, useSession, type TakeSummary } from "@/lib/session";
import { scoreWord, when } from "@/lib/music";
import Trend from "@/components/Trend";

const TREND = "#8a78ff";   // validated for the dark surface (same as the chart in components/Trend)

// a song's key for its heart: the same artist and title is the same song (a take may be by Spotify's id, the song
// kept by its ISRC)
const songKey = (t: { name: string; artist: string }) => `${t.artist}\u0000${t.name}`.toLowerCase().replace(/[\s!-/:-@[-`{-~]/g, "");

export default function History() {
  const [takes, setTakes] = useState<TakeSummary[] | null>(null);
  // takes from this session still being scored or learned; the saved list reloads as each one finishes
  useEffect(() => { live.start(); }, []);
  const { takes: session, learning } = useSession();
  const pending = session.filter(t => t.status === "scoring" || t.status === "learning");
  const finished = session.filter(t => t.status === "done").length;
  useEffect(() => { getTakes().then(setTakes).catch(() => setTakes([])); }, [finished]);
  // hearts, from the library (by id, and by artist and title)
  const [hearts, setHearts] = useState<Map<string, boolean>>(new Map());
  useEffect(() => {
    getLibrary().then(lib => {
      const m = new Map<string, boolean>();
      for (const s of lib) if (s?.track?.id) { m.set(s.track.id, !!s.favorite); m.set(songKey(s.track), !!s.favorite); }
      setHearts(m);
    }).catch(() => {});
  }, [finished]);
  const hearted = (t: TakeSummary["track"]) => hearts.get(t.id) ?? hearts.get(songKey(t)) ?? false;
  function heart(t: TakeSummary["track"], on: boolean) {
    setHearts(h => new Map(h).set(t.id, on).set(songKey(t), on));
    void setFavorite(t, on);
  }
  const real = useMemo(() => (takes ?? []).filter(t => t.coverage >= 0.1), [takes]);
  async function remove(ids: string[]) {
    for (const id of ids) await deleteTake(id);
    setTakes(ts => (ts ?? []).filter(t => !ids.includes(t.id)));
  }

  const songs = useMemo(() => {
    const by = new Map<string, TakeSummary[]>();
    for (const t of real) by.set(t.track.id, [...(by.get(t.track.id) ?? []), t]);
    return [...by.values()].map(ts => {
      const asc = ts.slice().sort((a, b) => a.recorded.localeCompare(b.recorded));
      return { track: ts[0].track, takes: asc, best: Math.max(...ts.map(t => t.score)), last: asc[asc.length - 1] };
    }).sort((a, b) => b.last.recorded.localeCompare(a.last.recorded));
  }, [real]);

  // each play's number for its song (1 = the first time you sang it)
  const playNo = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of songs) s.takes.forEach((t, i) => m.set(t.id, i + 1));
    return m;
  }, [songs]);

  const recent10 = real.slice(0, 10);
  const avg = recent10.length ? Math.round(recent10.reduce((s, t) => s + t.score, 0) / recent10.length) : null;
  const best = real.length ? Math.max(...real.map(t => t.score)) : null;

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      <header data-tauri-drag-region className="app-header flex items-center gap-5 px-6 pt-4 pb-3"><Logo /><Nav /></header>
      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-6 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">演唱记录</h1>
          <p className="mt-1 text-ink-300">每首唱过的歌都会生成一条练习记录。这里可以查看练习情况。</p>
        </div>

        {pending.length > 0 && (
          <section className="mb-4 space-y-2">
            {pending.map((t, i) => {
              // how far its learning has got (a take only scored has no learn going on)
              const job = learnOf(learning, [], { id: t.track_id ?? "", name: t.name, artist: t.artist });
              return (
              <div key={i} className="glass flex items-center gap-4 rounded-2xl px-5 py-3.5">
                <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-400" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="truncate text-xs text-ink-400">{t.artist}</div>
                </div>
                {job && job.fraction != null
                  ? <LearnBar job={job} className="w-56 shrink-0" />
                  : <div className="text-sm text-ink-300">{t.status === "learning" ? "正在学习歌曲，之后会评估本次演唱…" : "正在评分…"}</div>}
              </div>
            ); })}
          </section>
        )}
        {takes === null ? <Skeleton /> : real.length === 0 ? (pending.length ? null : <Empty />) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="练习次数" value={real.length} />
              <Stat label="最近 10 次平均分" value={avg ?? "–"} sub={avg != null ? scoreWord(avg) : ""} />
              <Stat label="最高分" value={best ?? "–"} sub={best != null ? real.find(t => t.score === best)?.track.name : ""} />
              <Stat label="歌曲数" value={songs.length} />
            </section>

            <section className="glass mt-4 rounded-3xl p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-ink-200">每次练习得分</h2>
                <span className="text-xs text-ink-400">从早到晚</span>
              </div>
              <Trend takes={real.slice().reverse()} />
            </section>

            <section className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-ink-200">歌曲</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {songs.map(s => <SongCard key={s.track.id} s={s} onDelete={() => remove(s.takes.map(t => t.id))}
                                          fav={hearted(s.track)} onFav={on => heart(s.track, on)} />)}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-ink-200">所有练习记录</h2>
              <div className="glass overflow-hidden rounded-3xl">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-ink-400">
                    <tr className="border-b border-white/6">
                      <th className="px-5 py-3 font-medium">歌曲</th><th className="px-3 py-3 font-medium">时间</th>
                      <th className="px-3 py-3 text-right font-medium">命中音符</th><th className="px-3 py-3 text-right font-medium">音准</th>
                      <th className="px-3 py-3 text-right font-medium">得分</th><th className="w-12 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {real.map(t => (
                      <tr key={t.id} className="border-b border-white/4 transition last:border-0 hover:bg-white/3">
                        <td className="px-5 py-3"><Link href={`/take?id=${encodeURIComponent(t.id)}`} className="block">
                          <div className="font-medium">{t.track.name} <span className="tabular text-xs font-normal text-ink-400">#{playNo.get(t.id)}</span></div>
                          <div className="flex items-center gap-2 text-xs text-ink-400">{t.track.artist}
                            <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${t.mode === "learn" || t.blind ? "bg-white/6 text-ink-300" : "bg-accent-500/12 text-accent-300"}`}>
                              {t.mode === "learn" || t.blind ? "盲唱" : "引导演唱"}</span></div></Link></td>
                        <td className="px-3 py-3 text-ink-300">{when(t.recorded)}</td>
                        <td className="tabular px-3 py-3 text-right text-ink-200">{t.notes_total ? `${t.notes_hit}/${t.notes_total}` : "–"}</td>
                        <td className="tabular px-3 py-3 text-right text-ink-200">{Math.round(100 * t.accuracy)}%</td>
                        <td className="tabular px-3 py-3 text-right text-lg font-semibold">{t.score}</td>
                        <td className="relative pr-3 text-right">
                          <span className="inline-flex justify-end">
                            <DeleteButton what="删除这条练习记录（会移到废纸篓）" confirm="确定删除这条练习记录吗？" onDelete={() => remove([t.id])} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl px-5 py-4">
      <div className="text-xs text-ink-400">{label}</div>
      <div className="tabular mt-1 text-3xl font-bold tracking-tight">{value}</div>
      <div className="mt-0.5 truncate text-xs text-ink-300">{sub || " "}</div>
    </div>
  );
}

function SongCard({ s, onDelete, fav, onFav }: { s: { track: TakeSummary["track"]; takes: TakeSummary[]; best: number; last: TakeSummary };
                                                 onDelete: () => Promise<void>; fav: boolean; onFav: (on: boolean) => void }) {
  const pts = s.takes.map(t => t.score);
  const W = 120, H = 34;
  const sx = (i: number) => (pts.length <= 1 ? W / 2 : (i / (pts.length - 1)) * W), sy = (v: number) => 3 + (1 - v / 100) * (H - 6);
  const router = useRouter();
  const open = () => router.push(`/song?id=${encodeURIComponent(s.track.id)}`);
  const job = useLearn(s.track);     // still being learned: it can be sung again once that's done
  // the whole card opens the song's page; its buttons (sing it again, delete) do their own thing
  return (
    <div role="link" tabIndex={0} onClick={open} onKeyDown={e => { if (e.key === "Enter") open(); }}
         className="glass group cursor-pointer rounded-3xl p-4 transition hover:-translate-y-0.5 hover:border-accent-400/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Cover name={s.track.name} art={s.track.art} link={s.track.link} size={44} />
          <div className="min-w-0">
            <div className="truncate font-medium">{s.track.name}</div>
            <div className="truncate text-sm text-ink-400">{s.track.artist}</div>
          </div>
        </div>
        <div className="flex items-start gap-1">
        <Heart on={fav} onToggle={onFav} subtle />
        <DeleteButton what={`删除该歌曲的 ${s.takes.length} 条练习记录（会移到废纸篓）`}
                      confirm={`确定删除 ${s.takes.length} 条练习记录吗？`} onDelete={onDelete} />
        <div className="text-right">
          <div className="tabular text-2xl font-bold leading-none">{s.best}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400">最高分</div>
        </div>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <svg width={W} height={H} aria-label={`得分记录：${pts.join("、")}`}>
          <path d={pts.map((v, i) => `${i ? "L" : "M"}${sx(i)},${sy(v)}`).join(" ")} fill="none" stroke={TREND} strokeWidth={2} strokeLinecap="round" />
          <circle cx={sx(pts.length - 1)} cy={sy(pts[pts.length - 1])} r={3.5} fill={TREND} />
        </svg>
        <div className="text-right text-xs text-ink-400 transition group-hover:text-ink-100">{s.takes.length} 次 · 最近得分 {s.last.score} · 查看全部</div>
      </div>
      {job && <LearnBar job={job} showPct={false} className="mt-3" />}
      <button onClick={e => { e.stopPropagation(); if (!job) void playTrack(s.track.id, true, s.track.name); }} disabled={!!job}
              title={job ? "学习完成后即可再次演唱" : undefined}
              className="tabular mt-3 w-full rounded-xl bg-white/5 py-2 text-sm font-medium text-ink-100 transition hover:bg-accent-500/20 hover:text-white
                         disabled:cursor-default disabled:text-ink-400 disabled:hover:bg-white/5 disabled:hover:text-ink-400">
        {job ? learnLabel(job) : "再唱一次"}
      </button>
    </div>
  );
}

function Empty() {
  return (
    <div className="glass grid place-items-center rounded-3xl px-6 py-20 text-center">
      <div>
        <h2 className="text-xl font-semibold">还没有练习记录</h2>
        <p className="mt-1 text-ink-300">跟唱一首歌至少 20 秒，练习记录就会显示在这里。</p>
        <Link href="/" className="mt-5 inline-block rounded-xl bg-accent-500 px-4 py-2 font-medium text-white transition hover:bg-accent-400">开始演唱</Link>
      </div>
    </div>
  );
}
function Skeleton() {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="glass h-[104px] rounded-2xl shimmer" />)}</div>;
}
