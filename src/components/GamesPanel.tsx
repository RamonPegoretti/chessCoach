"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { EmptyState, PageHeader, RESULT_STYLE } from "./ui";
import { GameReview } from "./GameReview";
import type { Go } from "./App";

const PAGE = 50;

export function GamesPanel({ openId, go }: { openId: string | null; go: Go }) {
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
  if (open) return <GameReview game={open} onBack={() => go("games")} />;

  if (!games.length) {
    return <EmptyState title="No games yet">Import an account or paste a PGN first.</EmptyState>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Games"
        title="Every game, reviewed"
        sub={`${games.length.toLocaleString()} games. Click one to replay it with the engine's comments.`}
      />
      <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-ink/90 px-1 py-3 backdrop-blur md:top-0">
        <input
          className="min-w-0 flex-1 rounded-full border border-line bg-panel px-4 py-2.5 text-sm outline-none placeholder:text-faint focus:border-brass"
          placeholder="Search opening or opponent"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
        />
        <div className="flex rounded-full border border-line bg-panel p-1">
          {(["all", "win", "draw", "loss"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setResult(r)}
              className={`rounded-full px-3 py-1.5 text-xs capitalize transition ${result === r ? "bg-raised text-cream" : "text-muted hover:text-cream"}`}
            >
              {r === "all" ? "All" : r === "win" ? "Wins" : r === "loss" ? "Losses" : "Draws"}
            </button>
          ))}
        </div>
      </div>
      <p className="tabular mb-2 mt-2 text-xs text-faint">{list.length} games</p>
      <ul className="overflow-hidden rounded-2xl border border-line">
        {list.slice(0, limit).map((g) => {
          const opp = g.userColor === "w" ? g.black : g.white;
          const blunders = g.analysis?.moves.filter((m) => m.cls === "blunder").length;
          return (
            <li key={g.id} className="border-b border-line last:border-0">
              <a
                href={`#/games/${encodeURIComponent(g.id)}`}
                className="flex items-center gap-4 bg-panel px-4 py-3.5 text-sm transition hover:bg-raised"
              >
                <span
                  className={`w-12 shrink-0 rounded-full px-2 py-1 text-center text-[11px] font-semibold capitalize ${RESULT_STYLE[g.result]}`}
                >
                  {g.result}
                </span>
                <span
                  className={`h-3 w-3 shrink-0 rounded-full border border-faint ${g.userColor === "w" ? "bg-cream" : "bg-ink"}`}
                  title={g.userColor === "w" ? "White" : "Black"}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-cream">
                    {opp} {g.opponentRating ? <span className="tabular text-faint">{g.opponentRating}</span> : null}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {g.opening} · <span className="capitalize">{g.speed}</span> ·{" "}
                    {new Date(g.playedAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right text-xs">
                  {g.analysis ? (
                    <>
                      <span className="text-cream">{g.analysis.accuracy}</span>
                      <span className="text-faint"> acc</span>
                      {blunders ? (
                        <span className="block text-coral">
                          {blunders} blunder{blunders > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </>
                  ) : queue.current === g.id ? (
                    <span className="text-brass">reviewing…</span>
                  ) : (
                    <span className="text-faint">queued</span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {list.length > limit && (
        <button
          className="mt-4 w-full rounded-full border border-line py-2.5 text-sm text-muted hover:text-cream"
          onClick={() => setLimit((l) => l + PAGE)}
        >
          Show more
        </button>
      )}
    </div>
  );
}
