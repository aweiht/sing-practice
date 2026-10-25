"use client";
// One song's history: how your score has moved play by play, and every play listed (numbered, dated) with a
// link to its report.
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Cover, { AppleMusicLink } from "@/components/Cover";
import DeleteButton from "@/components/DeleteButton";
import { Logo, Nav } from "@/components/Nav";
import Trend from "@/components/Trend";
import LearnBar from "@/components/LearnBar";
import { deleteTake, getTakes, learnLabel, playTrack, type TakeSummary, useLearn } from "@/lib/session";
import { scoreWord, when } from "@/lib/music";

export default function SongPage() {
  return <Suspense><Song /></Suspense>;
}

function Song() {
  const id = useSearchParams().get("id") ?? "";
  const [takes, setTakes] = useState<TakeSummary[] | null>(null);
  useEffect(() => { getTakes().then(setTakes).catch(() => setTakes([])); }, []);
  // oldest first: play 1 is the first time you sang it
  const plays = useMemo(() => (takes ?? []).filter(t => t.track.id === id && t.coverage >= 0.1)
    .sort((a, b) => a.recorded.localeCompare(b.recorded)), [takes, id]);
  const track = plays[0]?.track;
  const job = useLearn(track);     // still being learned: it can be sung again once that's done
  const best = plays.length ? Math.max(...plays.map(t => t.score)) : null;
  const first = plays[0]?.score ?? null, last = plays[plays.length - 1]?.score ?? null;
  async function remove(tid: string) {
    await deleteTake(tid);
    setTakes(ts => (ts ?? []).filter(t => t.id !== tid));
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_500px_at_50%_-10%,rgba(124,108,246,.10),transparent)]">
      <header data-tauri-drag-region className="app-header flex items-center gap-5 px-6 pt-4 pb-3"><Logo /><Nav /></header>
      <main className="mx-auto max-w-5xl px-6 pb-16">
        <Link href="/history" className="mt-4 inline-block text-sm text-ink-400 transition hover:text-ink-100">← 演唱记录</Link>
        {takes === null ? <div className="glass mt-6 h-40 rounded-3xl shimmer" /> : !track ? (
          <div className="glass mt-6 rounded-3xl px-6 py-16 text-center text-ink-300">这首歌还没有练习记录。</div>
        ) : (
          <>
            <div className="mt-4 mb-6 flex items-center gap-4">
              <Cover name={track.name} art={track.art} link={track.link} size={64} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-3xl font-semibold tracking-tight">{track.name}</h1>
                <div className="truncate text-ink-300">{track.artist}{track.link && <> <span className="text-ink-600">·</span> <AppleMusicLink link={track.link} className="text-sm" /></>}</div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button onClick={() => playTrack(track.id, true, track.name)} disabled={!!job} title={job ? "学习完成后即可再次演唱" : undefined}
                        className="tabular rounded-xl bg-accent-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-400 disabled:cursor-default disabled:bg-white/6 disabled:text-ink-300">
                  {job ? learnLabel(job) : "再唱一次"}</button>
                {job && <LearnBar job={job} showPct={false} className="w-44" />}
              </div>
            </div>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="演唱次数" value={plays.length} />
              <Stat label="最高分" value={best ?? "–"} sub={best != null ? scoreWord(best) : ""} />
              <Stat label="最近得分" value={last ?? "–"} sub={plays.length ? when(plays[plays.length - 1].recorded) : ""} />
              <Stat label="较首次演唱变化" value={first != null && last != null ? `${last - first >= 0 ? "+" : ""}${last - first}` : "–"}
                    sub={plays.length > 1 ? `${first} 分 → ${last} 分` : "再唱一次以查看变化"} />
            </section>

            <section className="glass mt-4 rounded-3xl p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-ink-200">每次演唱得分</h2>
                <span className="text-xs text-ink-400">从首次到最近</span>
              </div>
              <Trend takes={plays} />
            </section>

            <section className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-ink-200">每次演唱</h2>
              <div className="glass overflow-x-auto rounded-3xl">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-ink-400">
                    <tr className="border-b border-white/6">
                      <th className="px-5 py-3 font-medium">次数</th><th className="px-3 py-3 font-medium">时间</th>
                      <th className="px-3 py-3 text-right font-medium">命中音符</th><th className="px-3 py-3 text-right font-medium">音准</th>
                      <th className="px-3 py-3 text-right font-medium">得分</th><th className="w-12 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {plays.slice().reverse().map(t => {
                      const n = plays.indexOf(t) + 1;
                      return (
                        <tr key={t.id} className="border-b border-white/4 transition last:border-0 hover:bg-white/3">
                          <td className="px-5 py-3"><Link href={`/take?id=${encodeURIComponent(t.id)}`} className="flex items-center gap-2">
                            <span className="tabular font-medium">#{n}</span>
                            <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${t.mode === "learn" || t.blind ? "bg-white/6 text-ink-300" : "bg-accent-500/12 text-accent-300"}`}>
                              {t.mode === "learn" ? "首次演唱" : t.blind ? "盲唱" : "引导演唱"}</span></Link></td>
                          <td className="px-3 py-3 text-ink-300"><Link href={`/take?id=${encodeURIComponent(t.id)}`}>{when(t.recorded)}</Link></td>
                          <td className="tabular px-3 py-3 text-right text-ink-200">{t.notes_total ? `${t.notes_hit}/${t.notes_total}` : "–"}</td>
                          <td className="tabular px-3 py-3 text-right text-ink-200">{Math.round(100 * t.accuracy)}%</td>
                          <td className="tabular px-3 py-3 text-right text-lg font-semibold">{t.score}</td>
                          <td className="pr-3 text-right"><span className="inline-flex justify-end">
                            <DeleteButton what="删除这次演唱记录（会移到废纸篓）" confirm="确定删除这次演唱记录吗？" onDelete={() => remove(t.id)} />
                          </span></td>
                        </tr>
                      );
                    })}
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
