"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { StoredGame } from "@/lib/types";
import { useStore } from "./store";
import { ARROW_GOOD, BOARD, Button, Card, CLASS_STYLE, EvalBar, formatEval, moveNumber, RESULT_STYLE } from "./ui";

export function GameReview({ game, onBack }: { game: StoredGame; onBack: () => void }) {
  const { queue, prioritize } = useStore();
  const history = useMemo(() => {
    const c = new Chess();
    c.loadPgn(game.pgn);
    return c.history({ verbose: true });
  }, [game.pgn]);
  // ply = number of moves played on the board (0 = start position)
  const [ply, setPly] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPly((p) => Math.min(history.length, p + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history.length]);

  const a = game.analysis;
  const reviewed = useMemo(() => new Map(a?.moves.map((m) => [m.ply, m])), [a]);
  const fen = ply === 0 ? (history[0]?.before ?? new Chess().fen()) : history[ply - 1].after;
  const lastMove = ply > 0 ? history[ply - 1] : null;
  const lastReview = lastMove ? reviewed.get(ply - 1) : undefined;
  const flipped = game.userColor === "b";

  const arrows = [];
  if (lastReview && lastReview.cls !== "best" && lastReview.bestUci) {
    arrows.push({
      startSquare: lastReview.bestUci.slice(0, 2),
      endSquare: lastReview.bestUci.slice(2, 4),
      color: ARROW_GOOD,
    });
  }
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    const tint =
      lastReview && (lastReview.cls === "blunder" || lastReview.cls === "mistake")
        ? "rgba(232,116,94,0.5)"
        : "rgba(224,173,79,0.4)";
    squareStyles[lastMove.from] = { background: tint };
    squareStyles[lastMove.to] = { background: tint };
  }

  const mistakes = a?.moves.filter((m) => m.cls === "blunder" || m.cls === "mistake") ?? [];
  const isAnalysing = queue.current === game.id;

  return (
    <div className="flex flex-col gap-4">
      <button className="self-start text-sm text-muted hover:text-cream" onClick={onBack}>
        ← All games
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${RESULT_STYLE[game.result]}`}
            >
              {game.result}
            </span>
            <span className="text-xs text-faint">
              {new Date(game.playedAt).toLocaleDateString()} · <span className="capitalize">{game.speed}</span>
            </span>
          </div>
          <h1 className="font-display mt-3 text-3xl md:text-4xl">
            {game.white} <span className="text-faint">vs</span> {game.black}
          </h1>
          <p className="mt-1 text-sm text-muted">{game.opening}</p>
        </div>
        {game.url && (
          <a href={game.url} target="_blank" rel="noreferrer" className="text-sm text-brass hover:underline">
            Open original ↗
          </a>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div>
          <div className="flex items-stretch gap-3">
            {a && a.evals.length > 0 && <EvalBar cp={a.evals[ply] ?? 0} flipped={flipped} />}
            <div className="aspect-square min-w-0 flex-1">
              <Chessboard
                options={{
                  position: fen,
                  boardOrientation: flipped ? "black" : "white",
                  allowDragging: false,
                  arrows,
                  squareStyles,
                  ...BOARD,
                }}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="ghost" onClick={() => setPly(0)}>
              ⏮
            </Button>
            <Button variant="ghost" onClick={() => setPly((p) => Math.max(0, p - 1))}>
              ◀
            </Button>
            <Button variant="ghost" onClick={() => setPly((p) => Math.min(history.length, p + 1))}>
              ▶
            </Button>
            <Button variant="ghost" onClick={() => setPly(history.length)}>
              ⏭
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            {!a ? (
              <div className="flex flex-col gap-2 text-sm">
                <p>This game hasn&apos;t been reviewed yet.</p>
                {isAnalysing ? (
                  <p className="text-muted">Analysing… {Math.round((queue.progress ?? 0) * 100)}%</p>
                ) : (
                  <Button onClick={() => prioritize(game.id)}>Review this game next</Button>
                )}
              </div>
            ) : lastReview ? (
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${CLASS_STYLE[lastReview.cls].color}`}>
                    {moveNumber(lastReview.ply)} {lastReview.san} · {CLASS_STYLE[lastReview.cls].label}
                  </span>
                  <span className="text-muted">eval {formatEval(a.evals[ply])}</span>
                </div>
                {lastReview.cls !== "best" && (
                  <p className="mt-1 text-muted">
                    Best was <span className="font-semibold text-sage">{lastReview.bestSan}</span> (green arrow).
                  </p>
                )}
                {lastReview.explanation && <p className="mt-2 text-cream/90">{lastReview.explanation}</p>}
              </div>
            ) : (
              <div className="text-sm text-muted">
                <p>
                  Accuracy <span className="font-semibold">{a.accuracy}%</span> · {mistakes.length} mistakes and
                  blunders. Step through the moves, or jump to one below.
                </p>
                {a.evals.length > 0 && ply > 0 && <p className="mt-1 text-muted">eval {formatEval(a.evals[ply])}</p>}
              </div>
            )}
          </Card>

          {mistakes.length > 0 && (
            <Card>
              <h3 className="font-display text-xl">Key moments</h3>
              <ul className="mt-2 flex flex-col gap-1">
                {mistakes.map((m) => (
                  <li key={m.ply}>
                    <button className="w-full text-left text-sm hover:text-brass" onClick={() => setPly(m.ply + 1)}>
                      <span className={CLASS_STYLE[m.cls].color}>
                        {moveNumber(m.ply)} {m.san}
                        {CLASS_STYLE[m.cls].symbol}
                      </span>{" "}
                      <span className="text-muted">{m.explanation}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="max-h-80 overflow-y-auto">
            <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-y-0.5 text-sm">
              {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
                <MoveRow key={i} n={i} history={history} reviewed={reviewed} ply={ply} setPly={setPly} />
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MoveRow({
  n,
  history,
  reviewed,
  ply,
  setPly,
}: {
  n: number;
  history: { san: string }[];
  reviewed: Map<number, { cls: keyof typeof CLASS_STYLE }>;
  ply: number;
  setPly: (p: number) => void;
}) {
  const cell = (i: number) => {
    if (i >= history.length) return <span />;
    const r = reviewed.get(i);
    const style = r ? CLASS_STYLE[r.cls] : undefined;
    return (
      <button
        onClick={() => setPly(i + 1)}
        className={`rounded px-1.5 text-left ${ply === i + 1 ? "bg-raised text-cream" : "hover:bg-raised"} ${style?.color ?? "text-muted"}`}
      >
        {history[i].san}
        {style?.symbol}
      </button>
    );
  };
  return (
    <>
      <span className="text-faint">{n + 1}.</span>
      {cell(n * 2)}
      {cell(n * 2 + 1)}
    </>
  );
}
