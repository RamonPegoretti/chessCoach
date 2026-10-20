export type Source = "lichess" | "chesscom" | "pgn";
export type Color = "w" | "b";
export type Result = "win" | "loss" | "draw";
export type Speed = "bullet" | "blitz" | "rapid" | "classical" | "daily" | "unknown";
export type Phase = "opening" | "middlegame" | "endgame";

export type MoveClass = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export type Motif =
  | "hung-piece"
  | "lost-material"
  | "missed-capture"
  | "missed-fork"
  | "allowed-fork"
  | "allowed-attack"
  | "missed-mate"
  | "allowed-mate"
  | "positional";

/** A game as stored in IndexedDB. */
export interface StoredGame {
  /** `${source}:${sourceId}` */
  id: string;
  source: Source;
  /** Lowercased account name this game was imported for. */
  account: string;
  url?: string;
  pgn: string;
  white: string;
  black: string;
  userColor: Color;
  result: Result;
  userRating?: number;
  opponentRating?: number;
  opening: string;
  eco?: string;
  speed: Speed;
  rated: boolean;
  /** Unix ms of when the game was played (end time when known). */
  playedAt: number;
  analysis?: GameAnalysis;
}

/** One reviewed move made by the user. */
export interface ReviewedMove {
  ply: number;
  san: string;
  bestSan: string;
  bestUci: string;
  fenBefore: string;
  cls: MoveClass;
  /** Drop in the user's win chance, 0-100. */
  winDrop: number;
  accuracy: number;
  phase: Phase;
  /** Seconds left on the user's clock after the move, when the PGN has clocks. */
  clock?: number;
  motif?: Motif;
  explanation?: string;
}

export interface GameAnalysis {
  depth: number;
  /**
   * Engine eval of every position from White's point of view, in centipawns.
   * Mate is encoded as +/-(MATE_SCORE - plies).
   */
  evals: number[];
  /** Engine best move (UCI) in every position, "" when the game is over. */
  best: string[];
  /** Only the user's moves. */
  moves: ReviewedMove[];
  accuracy: number;
  /** Highest win chance the user had during the game, 0-100. */
  peakWin: number;
}

export const MATE_SCORE = 100000;
