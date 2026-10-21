"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, RESULT_STYLE } from "./ui";
import { GameReview } from "./GameReview";

const PAGE = 50;

export function GamesPanel({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }) {
  const { games, queue } = useStore();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<"all" | "win" | "loss" | "draw">("all");
  const [limit, setLimit] = useState(PAGE);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games
      .filter((g) => result === "all" || g.result === result)
      .filter(
        (g) =>
          !q ||
          g.opening.toLowerCase().includes(q) ||
          g.white.toLowerCase().includes(q) ||
          g.black.toLowerCase().includes(q),
      )
      .sort((a, b) => b.playedAt - a.playedAt);
  }, [games, query, result]);

  const open = games.find((g) => g.id === openId);
  if (open) return <GameReview game={open} onBack={() => onOpen(null)} />;

  if (!games.length) {
    return <Card>No games yet. Import an account or paste a PGN first.</Card>;
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          placeholder="Search opening or opponent"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          value={result}
          onChange={(e) => setResult(e.target.value as typeof result)}
        >
          <option value="all">All results</option>
          <option value="win">Wins</option>
          <option value="loss">Losses</option>
          <option value="draw">Draws</option>
        </select>
      </div>
      <p className="mt-2 text-xs text-slate-400">{list.length} games</p>
      <ul className="mt-2 divide-y divide-slate-800">
        {list.slice(0, limit).map((g) => {
          const opp = g.userColor === "w" ? g.black : g.white;
          const blunders = g.analysis?.moves.filter((m) => m.cls === "blunder").length;
          return (
            <li key={g.id}>
              <button
                onClick={() => onOpen(g.id)}
                className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-slate-800/40"
              >
                <span className={`w-12 rounded px-1.5 py-0.5 text-center text-xs font-semibold ${RESULT_STYLE[g.result]}`}>
                  {g.result}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    vs {opp} {g.opponentRating ? <span className="text-slate-400">({g.opponentRating})</span> : null}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {g.userColor === "w" ? "White" : "Black"} · {g.opening} · {g.speed} ·{" "}
                    {new Date(g.playedAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="text-right text-xs text-slate-400">
                  {g.analysis ? (
                    <>
                      {g.analysis.accuracy}% acc
                      {blunders ? <span className="block text-red-400">{blunders} blunder{blunders > 1 ? "s" : ""}</span> : null}
                    </>
                  ) : g.id in queue.active ? (
                    "analysing…"
                  ) : (
                    "not reviewed"
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {list.length > limit && (
        <button className="mt-3 w-full text-sm text-emerald-400" onClick={() => setLimit((l) => l + PAGE)}>
          Show more
        </button>
      )}
    </Card>
  );
}
