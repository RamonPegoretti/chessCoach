import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import { MATE_SCORE, type Motif } from "./types";

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

const other = (c: Color): Color => (c === "w" ? "b" : "w");

function uciToMove(chess: Chess, uci: string) {
  if (!uci) return null;
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return null;
  }
}

/** Squares of enemy pieces (worth >= a knight, or the king) that the piece on `sq` attacks. */
function forkTargets(chess: Chess, sq: Square): Square[] {
  const piece = chess.get(sq);
  if (!piece) return [];
  const victimColor = other(piece.color);
  const targets: Square[] = [];
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== victimColor) continue;
      if (PIECE_VALUE[cell.type] < 3) continue;
      if (chess.attackers(cell.square, piece.color).includes(sq)) targets.push(cell.square);
    }
  }
  return targets;
}

function isFork(chess: Chess, sq: Square): boolean {
  const piece = chess.get(sq);
  if (!piece) return false;
  const targets = forkTargets(chess, sq);
  if (targets.length < 2) return false;
  // A fork only matters if something other than the king is actually up for grabs:
  // worth more than the forking piece, or undefended.
  return targets.some((t) => {
    const victim = chess.get(t)!;
    return (
      victim.type !== "k" &&
      (PIECE_VALUE[victim.type] > PIECE_VALUE[piece.type] || !chess.isAttacked(t, victim.color))
    );
  });
}

export interface MotifInput {
  fenBefore: string;
  playedUci: string;
  /** Best move for the user in fenBefore. */
  bestUci: string;
  /** Opponent's best reply after the played move. */
  replyUci: string;
  /** Eval (user's point of view) before and after the move, encoded cp. */
  userEvalBefore: number;
  userEvalAfter: number;
  mateThreshold: number;
}

/** Works out a simple, human-readable reason why a move was a mistake. */
export function detectMotif(m: MotifInput): { motif: Motif; explanation: string } {
  const user = new Chess(m.fenBefore).turn();
  const { userEvalBefore: before, userEvalAfter: after, mateThreshold } = m;

  // Mate first: it trumps everything.
  if (before >= mateThreshold && after < mateThreshold) {
    const n = Math.max(1, MATE_SCORE - before);
    return {
      motif: "missed-mate",
      explanation: `You had a forced mate in ${n}. Look for checks first when the enemy king is exposed.`,
    };
  }
  if (after <= -mateThreshold && before > -mateThreshold) {
    return {
      motif: "allowed-mate",
      explanation:
        "This move allowed a forced mate. Before moving, ask what checks and captures your opponent has.",
    };
  }

  // What the opponent can do after the played move.
  const afterMove = new Chess(m.fenBefore);
  const played = uciToMove(afterMove, m.playedUci);
  if (played) {
    const replyBoard = new Chess(afterMove.fen());
    const reply = uciToMove(replyBoard, m.replyUci);
    if (reply?.captured && PIECE_VALUE[reply.captured] >= 3) {
      const defended = replyBoard.isAttacked(reply.to, user);
      const name = PIECE_NAME[reply.captured];
      if (!defended) {
        return {
          motif: "hung-piece",
          explanation: `This left your ${name} on ${reply.to} undefended, and ${reply.san} just takes it.`,
        };
      }
      if (PIECE_VALUE[reply.piece] < PIECE_VALUE[reply.captured]) {
        return {
          motif: "lost-material",
          explanation: `Your ${name} on ${reply.to} could be taken by a ${PIECE_NAME[reply.piece]} (${reply.san}), losing material.`,
        };
      }
    }
    if (reply && isFork(replyBoard, reply.to)) {
      const targets = forkTargets(replyBoard, reply.to).map((s) => PIECE_NAME[replyBoard.get(s)!.type]);
      return {
        motif: "allowed-fork",
        explanation: `This allowed ${reply.san}, a fork hitting your ${targets.join(" and ")}.`,
      };
    }
    if (reply) {
      const hit = forkTargets(replyBoard, reply.to).find((t) => {
        const victim = replyBoard.get(t)!;
        return (
          victim.type !== "k" &&
          (!replyBoard.isAttacked(t, user) || PIECE_VALUE[victim.type] > PIECE_VALUE[reply.piece])
        );
      });
      if (hit) {
        return {
          motif: "allowed-attack",
          explanation: `This allowed ${reply.san}, which attacks your ${PIECE_NAME[replyBoard.get(hit)!.type]} on ${hit}, and it will cost you material.`,
        };
      }
    }
  }

  // What the user missed.
  const bestBoard = new Chess(m.fenBefore);
  const best = uciToMove(bestBoard, m.bestUci);
  if (best) {
    if (best.captured && PIECE_VALUE[best.captured] >= 3) {
      const free = !bestBoard.isAttacked(best.to, other(user));
      const name = PIECE_NAME[best.captured];
      if (free || PIECE_VALUE[best.piece] < PIECE_VALUE[best.captured]) {
        return {
          motif: "missed-capture",
          explanation: `You could have won material with ${best.san}, taking the ${free ? "undefended " : ""}${name} on ${best.to}.`,
        };
      }
    }
    if (isFork(bestBoard, best.to)) {
      const targets = forkTargets(bestBoard, best.to).map((s) => PIECE_NAME[bestBoard.get(s)!.type]);
      return {
        motif: "missed-fork",
        explanation: `${best.san} was a fork, attacking the ${targets.join(" and ")} at once.`,
      };
    }
  }

  return {
    motif: "positional",
    explanation: `No quick tactic here, but ${best?.san ?? "another move"} kept a much better position.`,
  };
}
