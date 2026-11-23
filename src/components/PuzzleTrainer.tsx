"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { Puzzle } from "@/lib/course";
import { MOTIF_LABEL } from "@/lib/labels";
import { PIECE_VALUE } from "@/lib/motifs";
import { useStore } from "./store";
import { ARROW_GOOD, BOARD, Button } from "./ui";

type Status = "solving" | "wrong" | "solved" | "shown";

const PIECE_NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** react-chessboard uses the id inside CSS selectors, so it may only contain safe characters. */
const boardId = (id: string) => `puzzle-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

const tint = (rgba: string): React.CSSProperties => ({ boxShadow: `inset 0 0 0 100vmax ${rgba}` });
const dot: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(20,17,15,0.32) 21%, transparent 23%)",
};
const ring: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, transparent 58%, rgba(20,17,15,0.42) 60%)",
};

/** The opponent's move that led to the puzzle position, for context. */
function previousMove(p: Puzzle): { from: string; to: string } | null {
  try {
    const c = new Chess();
    c.loadPgn(p.game.pgn);
    const m = c.history({ verbose: true })[p.move.ply - 1];
    return m ? { from: m.from, to: m.to } : null;
  } catch {
    return null;
  }
}

/** A short, honest reason why a wrong move is wrong, without an engine call. */
function wrongReason(p: Puzzle, played: Move): string {
  if (played.san === p.move.san) return "That's what you played in the game. Look for something better.";
  const after = new Chess(played.after);
  const to = played.to as Square;
  const piece = after.get(to);
  if (piece && piece.type !== "k" && piece.type !== "p") {
    const enemy = piece.color === "w" ? "b" : "w";
    const attackers = after.attackers(to, enemy);
    const defenders = after.attackers(to, piece.color);
    const cheapest = attackers.length ? Math.min(...attackers.map((s) => PIECE_VALUE[after.get(s)!.type])) : Infinity;
    if (attackers.length && (!defenders.length || cheapest < PIECE_VALUE[piece.type])) {
      return `That leaves your ${PIECE_NAME[piece.type]} on ${to} hanging.`;
    }
  }
  if (after.inCheck()) return "A check, but it doesn't lead anywhere. Look again.";
  return "Not the strongest move here. Look again.";
}

/**
 * Find-the-better-move trainer over a list of puzzles from your own games.
 * Unsolved puzzles come first; results are saved to progress.
 * Give it a `key` that changes with the puzzle set to restart from the first puzzle.
 */
export function PuzzleTrainer({ puzzles, onExhausted }: { puzzles: Puzzle[]; onExhausted?: () => void }) {
  const { progress, recordPuzzle } = useStore();
  // Freeze the order for this set, so solving one (or background analysis) doesn't reshuffle the queue.
  const [order] = useState(() => {
    const fresh = puzzles.filter((p) => progress.puzzles[p.id] !== "first");
    const done = puzzles.filter((p) => progress.puzzles[p.id] === "first");
    return [...fresh, ...done];
  });
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("solving");
  const [tries, setTries] = useState(0);
  const [fen, setFen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ from: string; to: string; good: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [locked, setLocked] = useState(false);
  const [streak, setStreak] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const puzzle = order.length ? order[index % order.length] : null;
  const prev = useMemo(() => (puzzle ? previousMove(puzzle) : null), [puzzle]);
  const legalFrom = useMemo(() => {
    if (!puzzle || !selected) return [];
    try {
      return new Chess(puzzle.move.fenBefore).moves({ square: selected as Square, verbose: true });
    } catch {
      return [];
    }
  }, [puzzle, selected]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const finished = status === "solved" || status === "shown";

  const next = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (index + 1 >= order.length) onExhausted?.();
    setIndex((i) => i + 1);
    setStatus("solving");
    setFen(null);
    setTries(0);
    setSelected(null);
    setFlash(null);
    setMessage("");
    setLocked(false);
  }, [index, order.length, onExhausted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished && (e.key === "Enter" || e.key === "ArrowRight")) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, next]);

  if (!puzzle) return null;
  const { game, move, id } = puzzle;
  const position = fen ?? move.fenBefore;
  const toMove = move.fenBefore.split(" ")[1] === "w" ? "white" : "black";
  const myColor = toMove === "white" ? "w" : "b";
  const opp = game.userColor === "w" ? game.black : game.white;
  const already = progress.puzzles[id];

  /** Try a move. Returns true if the piece should stay where it was dropped. */
  const attempt = (from: string, to: string): boolean => {
    if (finished || locked) return false;
    const chess = new Chess(move.fenBefore);
    const isBestSquares = move.bestUci.slice(0, 4) === from + to;
    let played: Move;
    try {
      played = chess.move({ from, to, promotion: isBestSquares && move.bestUci[4] ? move.bestUci[4] : "q" });
    } catch {
      setSelected(null);
      return false;
    }
    setSelected(null);
    const uci = played.from + played.to + (played.promotion ?? "");
    if (uci === move.bestUci || (move.bestUci.length === 4 && uci.slice(0, 4) === move.bestUci)) {
      setFen(chess.fen());
      setFlash({ from, to, good: true });
      setStatus("solved");
      setMessage("");
      recordPuzzle(id, tries === 0 ? "first" : "retry");
      setStreak((s) => (tries === 0 ? s + 1 : 0));
      return true;
    }
    // Wrong: let the move land, mark it red, then take it back.
    setFen(chess.fen());
    setFlash({ from, to, good: false });
    setTries((t) => t + 1);
    setStatus("wrong");
    setMessage(wrongReason(puzzle, played));
    setStreak(0);
    setLocked(true);
    timer.current = setTimeout(() => {
      setFen(null);
      setFlash(null);
      setLocked(false);
    }, 900);
    return true;
  };

  const showAnswer = () => {
    if (timer.current) clearTimeout(timer.current);
    const chess = new Chess(move.fenBefore);
    try {
      const m = chess.move({
        from: move.bestUci.slice(0, 2),
        to: move.bestUci.slice(2, 4),
        promotion: move.bestUci[4],
      });
      setFen(chess.fen());
      setFlash({ from: m.from, to: m.to, good: true });
    } catch {
      setFen(null);
      setFlash(null);
    }
    setLocked(false);
    setSelected(null);
    setStatus("shown");
    setMessage("");
    recordPuzzle(id, "shown");
    setStreak(0);
  };

  const onSquareClick = ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
    if (finished || locked) return;
    if (selected && selected !== square && legalFrom.some((m) => m.to === square)) {
      attempt(selected, square);
      return;
    }
    // Select one of your own pieces (pieceType looks like "wN").
    if (piece && piece.pieceType[0] === myColor) setSelected(square === selected ? null : square);
    else setSelected(null);
  };

  // Square highlights: previous opponent move, selection + legal targets, hint, and the result flash.
  const squareStyles: Record<string, React.CSSProperties> = {};
  if (prev && !flash) {
    squareStyles[prev.from] = tint("rgba(224,173,79,0.28)");
    squareStyles[prev.to] = tint("rgba(224,173,79,0.38)");
  }
  if (tries >= 2 && !finished && !flash) {
    squareStyles[move.bestUci.slice(0, 2)] = { boxShadow: "inset 0 0 0 4px rgba(224,173,79,0.95)" };
  }
  if (selected && !finished) {
    squareStyles[selected] = tint("rgba(140,192,132,0.45)");
    const board = new Chess(move.fenBefore);
    for (const m of legalFrom) squareStyles[m.to] = board.get(m.to as Square) ? ring : dot;
  }
  if (flash) {
    squareStyles[flash.from] = tint(flash.good ? "rgba(140,192,132,0.35)" : "rgba(232,116,94,0.35)");
    squareStyles[flash.to] = tint(flash.good ? "rgba(140,192,132,0.6)" : "rgba(232,116,94,0.65)");
  }

  const hint =
    move.motif && move.motif !== "positional"
      ? `Hint: ${MOTIF_LABEL[move.motif].hint}`
      : "Hint: check every capture and every check.";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,540px)_1fr]">
      <div className={`relative ${status === "wrong" && locked ? "animate-[shake_0.3s]" : ""}`}>
        <Chessboard
          key={id}
          options={{
            id: boardId(id),
            position,
            boardOrientation: toMove,
            allowDragging: !finished && !locked,
            canDragPiece: ({ piece }) => piece.pieceType[0] === myColor,
            onPieceDrag: ({ square }) => {
              if (square) setSelected(square);
            },
            onPieceDrop: ({ sourceSquare, targetSquare }) =>
              targetSquare ? attempt(sourceSquare, targetSquare) : false,
            onSquareClick,
            animationDurationInMs: 220,
            squareStyles,
            ...BOARD,
            arrows:
              status === "shown"
                ? [{ startSquare: move.bestUci.slice(0, 2), endSquare: move.bestUci.slice(2, 4), color: ARROW_GOOD }]
                : [],
          }}
        />
        {flash && (
          <div
            key={`${flash.to}-${tries}-${status}`}
            className={`animate-pop pointer-events-none absolute -right-3 -top-3 z-10 grid h-11 w-11 place-items-center rounded-full text-xl font-bold shadow-lg ${
              flash.good ? "bg-sage text-ink" : "bg-coral text-ink"
            }`}
          >
            {flash.good ? "✓" : "✕"}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between text-xs text-faint">
          <span className="tabular">
            Puzzle {(index % order.length) + 1} of {order.length}
          </span>
          {streak > 1 && <span className="text-brass">🔥 {streak} in a row</span>}
        </div>

        <div
          className={`rounded-2xl border p-5 transition-colors ${
            status === "solved"
              ? "border-sage/40 bg-sage/[0.06]"
              : status === "wrong"
                ? "border-coral/40 bg-coral/[0.05]"
                : "border-line bg-panel"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full border border-faint ${toMove === "white" ? "bg-cream" : "bg-ink"}`}
            />
            <span className="font-display text-2xl">
              {status === "solved"
                ? "Well found!"
                : status === "shown"
                  ? "Here's the move"
                  : `${toMove === "white" ? "White" : "Black"} to move`}
            </span>
          </div>

          {!finished && (
            <p className="mt-3 text-muted">
              Against <span className="text-cream">{opp}</span> you played{" "}
              <span className="font-semibold text-coral">{move.san}</span>. Find the better move.
              {prev && <span className="text-faint"> Your opponent&apos;s last move is highlighted.</span>}
            </p>
          )}

          <div className="mt-3 min-h-16 text-sm" aria-live="polite">
            {status === "wrong" && (
              <div className="flex flex-col gap-2">
                <p className="text-coral">{message}</p>
                <p className="text-amber">{hint}</p>
                {tries >= 2 && <p className="text-muted">The piece to move now has a gold outline.</p>}
              </div>
            )}
            {status === "solving" && already === "first" && (
              <p className="text-faint">You&apos;ve solved this one before.</p>
            )}
            {status === "solving" && !already && (
              <p className="text-faint">Drag a piece, or click it to see where it can go.</p>
            )}
            {finished && (
              <p className="leading-relaxed text-cream/90">
                <span className="font-semibold text-sage">{move.bestSan}</span>
                {status === "solved" && tries > 0 && (
                  <span className="text-muted">
                    {" "}
                    (after {tries} wrong {tries === 1 ? "try" : "tries"})
                  </span>
                )}
                .{" "}
                {move.explanation && (
                  <span className="text-muted">
                    In the game, {move.san} went wrong: {move.explanation}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!finished ? (
            <>
              <Button variant={tries >= 3 ? "primary" : "ghost"} onClick={showAnswer} disabled={locked}>
                Show answer
              </Button>
              <Button variant="quiet" onClick={next}>
                Skip
              </Button>
            </>
          ) : (
            <>
              <Button onClick={next}>Next puzzle →</Button>
              <span className="text-xs text-faint">or press Enter</span>
            </>
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
