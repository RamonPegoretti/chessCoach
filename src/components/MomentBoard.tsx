"use client";

import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { ReviewedMove, StoredGame } from "@/lib/types";
import { ARROW_BAD, ARROW_GOOD, BOARD } from "./ui";

function playedUci(move: ReviewedMove): string | null {
  try {
    const c = new Chess(move.fenBefore);
    const m = c.move(move.san);
    return m.from + m.to;
  } catch {
    return null;
  }
}

/** A static board showing one moment: the move you played (red) and the best move (green). */
export function MomentBoard({
  game,
  move,
  showPlayed = true,
  showBest = true,
  id,
}: {
  game: StoredGame;
  move: ReviewedMove;
  showPlayed?: boolean;
  showBest?: boolean;
  id: string;
}) {
  const played = playedUci(move);
  const arrows = [];
  if (showPlayed && played && played !== move.bestUci.slice(0, 4)) {
    arrows.push({ startSquare: played.slice(0, 2), endSquare: played.slice(2, 4), color: ARROW_BAD });
  }
  if (showBest && move.bestUci) {
    arrows.push({ startSquare: move.bestUci.slice(0, 2), endSquare: move.bestUci.slice(2, 4), color: ARROW_GOOD });
  }
  return (
    <Chessboard
      options={{
        id,
        position: move.fenBefore,
        boardOrientation: game.userColor === "w" ? "white" : "black",
        allowDragging: false,
        arrows,
        ...BOARD,
      }}
    />
  );
}
