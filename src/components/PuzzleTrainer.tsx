"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Puzzle } from "@/lib/course";
import { MOTIF_LABEL } from "@/lib/labels";
import { useStore } from "./store";
import { ARROW_GOOD, BOARD, Button } from "./ui";

type Status = "solving" | "wrong" | "solved" | "shown";

/**
 * Find-the-better-move trainer over a list of puzzles from your own games.
 * Unsolved puzzles come first; results are saved to progress.
 * Give it a `key` that changes with the puzzle set to restart from the first puzzle.
 */
export function PuzzleTrainer({ puzzles, onExhausted }: { puzzles: Puzzle[]; onExhausted?: () => void }) {
  const { progress, recordPuzzle } = useStore();
  // Freeze the order when the set changes, so solving one doesn't reshuffle the queue.
  const order = useMemo(() => {
    const fresh = puzzles.filter((p) => progress.puzzles[p.id] !== "first");
    const done = puzzles.filter((p) => progress.puzzles[p.id] === "first");
    return [...fresh, ...done];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzles]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("solving");
  const [tries, setTries] = useState(0);
  const [fen, setFen] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  if (!order.length) return null;
  const { game, move, id } = order[index % order.length];
  const position = fen ?? move.fenBefore;
  const toMove = move.fenBefore.split(" ")[1] === "w" ? "white" : "black";
  const opp = game.userColor === "w" ? game.black : game.white;
  const already = progress.puzzles[id];

  const next = () => {
    if (index + 1 >= order.length) onExhausted?.();
    setIndex((i) => i + 1);
    setStatus("solving");
    setFen(null);
    setTries(0);
  };

  const onDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare || status === "solved" || status === "shown") return false;
    const chess = new Chess(move.fenBefore);
    let played;
    try {
      played = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    } catch {
      return false;
    }
    const uci = played.from + played.to + (played.promotion ?? "");
    if (uci === move.bestUci || (move.bestUci.length === 4 && uci.slice(0, 4) === move.bestUci)) {
      setFen(chess.fen());
      setStatus("solved");
      recordPuzzle(id, tries === 0 ? "first" : "retry");
      setStreak((s) => (tries === 0 ? s + 1 : 0));
      return true;
    }
    setTries((t) => t + 1);
    setStatus("wrong");
    return false;
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,540px)_1fr]">
      <div className={status === "wrong" ? "animate-[shake_0.3s]" : ""}>
        <Chessboard
          options={{
            id: `puzzle-${id}`,
            position,
            boardOrientation: toMove,
            onPieceDrop: onDrop,
            ...BOARD,
            arrows:
              status === "shown"
                ? [{ startSquare: move.bestUci.slice(0, 2), endSquare: move.bestUci.slice(2, 4), color: ARROW_GOOD }]
                : [],
          }}
        />
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between text-xs text-faint">
          <span className="tabular">
            Puzzle {(index % order.length) + 1} of {order.length}
          </span>
          {streak > 1 && <span className="text-brass">🔥 {streak} in a row</span>}
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full border border-faint ${toMove === "white" ? "bg-cream" : "bg-ink"}`}
            />
            <span className="font-display text-2xl">{toMove === "white" ? "White" : "Black"} to move</span>
          </div>
          <p className="mt-3 text-muted">
            Against <span className="text-cream">{opp}</span> you played{" "}
            <span className="font-semibold text-coral">{move.san}</span>. There was something much better.
          </p>
          {move.motif && move.motif !== "positional" && status === "solving" && tries > 0 && (
            <p className="mt-3 text-sm text-amber">Hint: {MOTIF_LABEL[move.motif].hint}</p>
          )}
          <div className="mt-4 min-h-12 text-sm" aria-live="polite">
            {status === "wrong" && <p className="text-coral">Not that one. Look again.</p>}
            {status === "solved" && (
              <p className="text-sage">
                <span className="font-semibold">{move.bestSan}!</span>
                {move.explanation && (
                  <span className="text-cream/80">
                    {" "}
                    In the game, {move.san} went wrong: {move.explanation}
                  </span>
                )}
              </p>
            )}
            {status === "shown" && (
              <p className="text-cream/90">
                The move was <span className="font-semibold text-sage">{move.bestSan}</span>. {move.explanation}
              </p>
            )}
            {status === "solving" && already === "first" && (
              <p className="text-faint">You&apos;ve solved this one before.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {status !== "solved" && status !== "shown" ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setStatus("shown");
                  recordPuzzle(id, "shown");
                  setStreak(0);
                }}
              >
                Show answer
              </Button>
              <Button variant="quiet" onClick={next}>
                Skip
              </Button>
            </>
          ) : (
            <Button onClick={next}>Next puzzle →</Button>
          )}
        </div>
        <p className="text-xs text-faint">
          From your {game.speed} game on {new Date(game.playedAt).toLocaleDateString()} ·{" "}
          <a
            className="underline-offset-4 hover:text-cream hover:underline"
            href={`#/games/${encodeURIComponent(game.id)}`}
          >
            open the game
          </a>
        </p>
      </div>
    </div>
  );
}
