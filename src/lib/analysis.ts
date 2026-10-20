import { Chess, type PieceSymbol } from "chess.js";
import type { Evaluator } from "./engine";
import { detectMotif, PIECE_VALUE } from "./motifs";
import {
  MATE_SCORE,
  type Color,
  type GameAnalysis,
  type MoveClass,
  type Phase,
  type ReviewedMove,
} from "./types";

const MATE_THRESHOLD = MATE_SCORE - 1000;

/** Lichess' win-chance model: centipawns -> 0..100 for the side the score belongs to. */
export function winChance(cp: number): number {
  if (cp >= MATE_THRESHOLD) return 100;
  if (cp <= -MATE_THRESHOLD) return 0;
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

/** Lichess' per-move accuracy from the drop in win chance. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export function classify(winDrop: number): MoveClass {
  if (winDrop >= 30) return "blunder";
  if (winDrop >= 20) return "mistake";
  if (winDrop >= 10) return "inaccuracy";
  if (winDrop >= 2) return "good";
  return "best";
}

export function gamePhase(fen: string, ply: number): Phase {
  const board = fen.split(" ")[0];
  let material = 0;
  let queens = 0;
  for (const ch of board) {
    const t = ch.toLowerCase() as PieceSymbol;
    if (t === "n" || t === "b" || t === "r" || t === "q") material += PIECE_VALUE[t];
    if (t === "q") queens++;
  }
  if (material <= 26 || (queens === 0 && material <= 32)) return "endgame";
  if (ply < 24) return "opening";
  return "middlegame";
}

function parseClock(comment: string | undefined): number | undefined {
  const m = comment?.match(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/);
  if (!m) return undefined;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Evaluate a position, handling finished games without asking the engine. */
async function evalPosition(chess: Chess, engine: Evaluator, depth: number) {
  if (chess.isCheckmate()) return { score: -MATE_SCORE, bestmove: "" };
  if (chess.isDraw() || chess.isStalemate()) return { score: 0, bestmove: "" };
  return engine.evaluate(chess.fen(), depth);
}

export interface AnalyzeOptions {
  depth?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: { cancelled: boolean };
}

export async function analyzeGame(
  pgn: string,
  userColor: Color,
  engine: Evaluator,
  opts: AnalyzeOptions = {},
): Promise<GameAnalysis | null> {
  const depth = opts.depth ?? 12;
  const game = new Chess();
  game.loadPgn(pgn);
  const history = game.history({ verbose: true });
  const comments = new Map(game.getComments().map((c) => [c.fen, c.comment]));

  const replay = new Chess(history[0]?.before);
  engine.newGame();

  // White-POV evals and best moves for every position (n moves -> n+1 positions).
  const evals: number[] = [];
  const best: string[] = [];
  for (let i = 0; i <= history.length; i++) {
    if (opts.signal?.cancelled) return null;
    const r = await evalPosition(replay, engine, depth);
    evals.push(replay.turn() === "w" ? r.score : -r.score);
    best.push(r.bestmove);
    opts.onProgress?.(i + 1, history.length + 1);
    if (i < history.length) replay.move(history[i].san);
  }

  const sign = userColor === "w" ? 1 : -1;
  const moves: ReviewedMove[] = [];
  let peakWin = 0;
  for (let i = 0; i < history.length; i++) {
    const mv = history[i];
    const userBefore = sign * evals[i];
    peakWin = Math.max(peakWin, winChance(sign * evals[i + 1]));
    if (mv.color !== userColor) continue;
    const userAfter = sign * evals[i + 1];
    const wBefore = winChance(userBefore);
    const wAfter = winChance(userAfter);
    const playedUci = mv.from + mv.to + (mv.promotion ?? "");
    const isBest = playedUci === best[i];
    const winDrop = isBest ? 0 : Math.max(0, wBefore - wAfter);
    let cls = classify(winDrop);
    // Walking into a forced mate is always a blunder, however bad things already were.
    if (userAfter <= -MATE_THRESHOLD && userBefore > -MATE_THRESHOLD) cls = "blunder";
    else if (userBefore >= MATE_THRESHOLD && userAfter < MATE_THRESHOLD && cls !== "blunder") cls = "mistake";

    const bestBoard = new Chess(mv.before);
    let bestSan = mv.san;
    try {
      if (best[i]) {
        bestSan = bestBoard.move({
          from: best[i].slice(0, 2),
          to: best[i].slice(2, 4),
          promotion: best[i][4],
        }).san;
      }
    } catch {
      /* engine move did not parse; keep the played move */
    }

    const rm: ReviewedMove = {
      ply: i,
      san: mv.san,
      bestSan,
      bestUci: best[i],
      fenBefore: mv.before,
      cls,
      winDrop: Math.round(winDrop * 10) / 10,
      accuracy: Math.round(moveAccuracy(wBefore, wAfter) * 10) / 10,
      phase: gamePhase(mv.before, i),
      clock: parseClock(comments.get(mv.after)),
    };
    if (cls === "mistake" || cls === "blunder" || cls === "inaccuracy") {
      Object.assign(
        rm,
        detectMotif({
          fenBefore: mv.before,
          playedUci,
          bestUci: best[i],
          replyUci: best[i + 1],
          userEvalBefore: userBefore,
          userEvalAfter: userAfter,
          mateThreshold: MATE_THRESHOLD,
        }),
      );
    }
    moves.push(rm);
  }

  const accuracy = moves.length
    ? Math.round((moves.reduce((s, m) => s + m.accuracy, 0) / moves.length) * 10) / 10
    : 0;
  return { depth, evals, best, moves, accuracy, peakWin: Math.round(peakWin) };
}
