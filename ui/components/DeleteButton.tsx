"use client";
// A small trash button that asks before deleting (inline, no dialog). Deleted things go to the Trash.
import { useState } from "react";

export default function DeleteButton({ what, confirm, onDelete, className = "" }:
    { what: string; confirm: string; onDelete: () => Promise<void> | void; className?: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (asking)
    return (
      <span className={`flex items-center gap-1.5 rounded-full bg-ink-950/90 p-1 pl-3 text-xs whitespace-nowrap shadow-lg ${className}`}
            onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
        <span className="text-ink-300">{confirm}</span>
        <button disabled={busy} onClick={async () => { setBusy(true); await onDelete(); setBusy(false); setAsking(false); }}
                className="rounded-full bg-off/20 px-2.5 py-1 font-medium text-off transition hover:bg-off/30">删除</button>
        <button onClick={() => setAsking(false)} className="rounded-full px-2.5 py-1 text-ink-300 transition hover:bg-white/8">取消</button>
      </span>
    );
  return (
    <button onClick={e => { e.preventDefault(); e.stopPropagation(); setAsking(true); }} title={what} aria-label={what}
            className={`grid h-7 w-7 place-items-center rounded-full text-ink-400 transition hover:bg-white/8 hover:text-off ${className}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
    </button>
  );
}
