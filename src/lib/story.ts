import { Chess, type PieceSymbol, type Square } from "chess.js";
import { PIECE_VALUE } from "./motifs";
import { winChance } from "./analysis";
import type { Profile } from "./profile";
import type { ReviewedMove, StoredGame } from "./types";

/** Style dimensions, each 0..1. */
export interface Style {
  /** Captures, checks and attacks on the enemy king. */
  aggression: number;
  /** Sound sacrifices: offering material the engine approves of. */
  sacrifice: number;
  /** How wild the evaluation swings are in your games. */
  chaos: number;
  /** Clean, accurate play. */
  precision: number;
  /** How often you reach and handle endgames. */
  endgame: number;
  /** Fighting spirit: decisive results, few draws. */
  decisive: number;
  /** Open, gambit-ish 1.e4 openings vs closed 1.d4 / flank play. */
  openness: number;
}

export const STYLE_LABEL: Record<keyof Style, { name: string; low: string; high: string }> = {
  aggression: { name: "Aggression", low: "Patient", high: "Attacking" },
  sacrifice: { name: "Sacrifices", low: "Materialist", high: "Romantic" },
  chaos: { name: "Complexity", low: "Calm positions", high: "Chaos" },
  precision: { name: "Precision", low: "Loose", high: "Surgical" },
  endgame: { name: "Endgames", low: "Avoids them", high: "Grinder" },
  decisive: { name: "Fighting spirit", low: "Solid", high: "No draws" },
  openness: { name: "Openings", low: "Closed", high: "Open & sharp" },
};

export interface Legend {
  id: string;
  name: string;
  years: string;
  nickname: string;
  blurb: string;
  style: Style;
}

export const LEGENDS: Legend[] = [
  {
    id: "tal",
    name: "Mikhail Tal",
    years: "1936–1992",
    nickname: "The Magician from Riga",
    blurb: "You drag opponents into a dark forest where 2 + 2 = 5. Sacrifices first, calculation later.",
    style: { aggression: 0.95, sacrifice: 1, chaos: 1, precision: 0.45, endgame: 0.3, decisive: 0.85, openness: 0.9 },
  },
  {
    id: "fischer",
    name: "Bobby Fischer",
    years: "1943–2008",
    nickname: "The Lone American",
    blurb: "Clear plans, active pieces and almost no wasted moves. You play to win every single game.",
    style: {
      aggression: 0.7,
      sacrifice: 0.35,
      chaos: 0.45,
      precision: 0.95,
      endgame: 0.65,
      decisive: 0.9,
      openness: 0.85,
    },
  },
  {
    id: "capablanca",
    name: "José Raúl Capablanca",
    years: "1888–1942",
    nickname: "The Chess Machine",
    blurb: "Simple, clean, effortless. You trade into endgames and win them like it's nothing.",
    style: {
      aggression: 0.35,
      sacrifice: 0.15,
      chaos: 0.15,
      precision: 0.95,
      endgame: 0.95,
      decisive: 0.5,
      openness: 0.5,
    },
  },
  {
    id: "karpov",
    name: "Anatoly Karpov",
    years: "b. 1951",
    nickname: "The Boa Constrictor",
    blurb: "You squeeze. Small advantages pile up until your opponent runs out of moves.",
    style: {
      aggression: 0.3,
      sacrifice: 0.1,
      chaos: 0.2,
      precision: 0.85,
      endgame: 0.8,
      decisive: 0.55,
      openness: 0.25,
    },
  },
  {
    id: "kasparov",
    name: "Garry Kasparov",
    years: "b. 1963",
    nickname: "The Beast of Baku",
    blurb: "Dynamic energy backed by hard calculation. You take the initiative and never give it back.",
    style: {
      aggression: 0.9,
      sacrifice: 0.6,
      chaos: 0.75,
      precision: 0.85,
      endgame: 0.5,
      decisive: 0.8,
      openness: 0.7,
    },
  },
  {
    id: "carlsen",
    name: "Magnus Carlsen",
    years: "b. 1990",
    nickname: "The Mozart of Chess",
    blurb: "Any opening, any position. You keep playing long after others would have agreed a draw.",
    style: { aggression: 0.55, sacrifice: 0.25, chaos: 0.4, precision: 0.9, endgame: 1, decisive: 0.75, openness: 0.5 },
  },
  {
    id: "petrosian",
    name: "Tigran Petrosian",
    years: "1929–1984",
    nickname: "Iron Tigran",
    blurb: "You see danger before it exists. Prophylaxis, safety and very few losses.",
    style: {
      aggression: 0.15,
      sacrifice: 0.2,
      chaos: 0.1,
      precision: 0.8,
      endgame: 0.6,
      decisive: 0.15,
      openness: 0.2,
    },
  },
  {
    id: "morphy",
    name: "Paul Morphy",
    years: "1837–1884",
    nickname: "The Pride and Sorrow of Chess",
    blurb: "Develop fast, open the centre, attack the king. Your games are short and brutal.",
    style: { aggression: 1, sacrifice: 0.75, chaos: 0.65, precision: 0.6, endgame: 0.1, decisive: 1, openness: 1 },
  },
  {
    id: "nakamura",
    name: "Hikaru Nakamura",
    years: "b. 1987",
    nickname: "The Speed King",
    blurb: "Tricky, provocative and fast. You set problems and wait for your opponent to crack.",
    style: {
      aggression: 0.8,
      sacrifice: 0.45,
      chaos: 0.85,
      precision: 0.6,
      endgame: 0.55,
      decisive: 0.85,
      openness: 0.6,
    },
  },
];

export interface Moment {
  game: StoredGame;
  move: ReviewedMove;
}

export interface ScorePart {
  label: string;
  value: number;
  weight: number;
}

export interface Story {
  games: number;
  analysed: number;
  score: number;
  tier: { name: string; next?: { name: string; at: number } };
  scoreParts: ScorePart[];
  style: Style;
  legend: Legend;
  match: number;
  runnerUp: Legend;
  costliest?: Moment & { wasWinning: boolean; lostGame: boolean; winBefore: number };
  brilliant?: Moment;
  finest?: StoredGame;
  bestOpening?: Profile["openings"][number];
  worstOpening?: Profile["openings"][number];
  sacrifices: number;
  longestGame?: StoredGame;
  favouriteFirstMove?: { san: string; share: number };
}

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Is the piece on `sq` offered: attacked and either undefended or attacked by a cheaper piece? */
function isOffered(chess: Chess, sq: Square): boolean {
  const piece = chess.get(sq);
  if (!piece || piece.type === "k" || piece.type === "p") return false;
  const enemy = piece.color === "w" ? "b" : "w";
  const attackers = chess.attackers(sq, enemy);
  if (!attackers.length) return false;
  const defenders = chess.attackers(sq, piece.color);
  const cheapest = Math.min(...attackers.map((s) => PIECE_VALUE[chess.get(s)!.type as PieceSymbol]));
  return !defenders.length || cheapest < PIECE_VALUE[piece.type];
}

interface GameFeatures {
  captures: number;
  checks: number;
  kingZone: number;
  moves: number;
  sacrifices: { move: ReviewedMove; gain: number }[];
  firstMove?: string;
}

// Games are immutable objects (a new object when analysis lands), so features can be cached per object.
const featureCache = new WeakMap<StoredGame, GameFeatures>();

function gameFeatures(g: StoredGame): GameFeatures {
  let cached = featureCache.get(g);
  if (!cached) {
    cached = computeFeatures(g);
    featureCache.set(g, cached);
  }
  return cached;
}

function computeFeatures(g: StoredGame): GameFeatures {
  const f: GameFeatures = { captures: 0, checks: 0, kingZone: 0, moves: 0, sacrifices: [] };
  const chess = new Chess();
  try {
    chess.loadPgn(g.pgn);
  } catch {
    return f;
  }
  const history = chess.history({ verbose: true });
  const reviewed = new Map(g.analysis?.moves.map((m) => [m.ply, m]));
  if (g.userColor === "w") f.firstMove = history[0]?.san;
  for (let i = 0; i < history.length; i++) {
    const mv = history[i];
    if (mv.color !== g.userColor) continue;
    f.moves++;
    if (mv.captured) f.captures++;
    if (mv.san.includes("+") || mv.san.includes("#")) f.checks++;
    // Moves landing within two files/ranks of the enemy king.
    const after = new Chess(mv.after);
    const kingSq = after
      .board()
      .flat()
      .find((c) => c && c.type === "k" && c.color !== g.userColor)?.square;
    if (kingSq) {
      const df = Math.abs(kingSq.charCodeAt(0) - mv.to.charCodeAt(0));
      const dr = Math.abs(Number(kingSq[1]) - Number(mv.to[1]));
      if (df <= 2 && dr <= 2 && mv.piece !== "k") f.kingZone++;
    }
    const r = reviewed.get(i);
    if (r && (r.cls === "best" || r.cls === "good") && !mv.captured && isOffered(after, mv.to as Square)) {
      f.sacrifices.push({ move: r, gain: PIECE_VALUE[mv.piece] });
    }
  }
  return f;
}

function tierFor(score: number): Story["tier"] {
  const tiers = [
    { name: "Pawn", at: 0 },
    { name: "Knight", at: 40 },
    { name: "Bishop", at: 55 },
    { name: "Rook", at: 68 },
    { name: "Queen", at: 80 },
    { name: "King", at: 90 },
  ];
  let i = 0;
  while (i + 1 < tiers.length && score >= tiers[i + 1].at) i++;
  return { name: tiers[i].name, next: tiers[i + 1] };
}

export function buildStory(games: StoredGame[], profile: Profile): Story | null {
  const analysed = games.filter((g) => g.analysis && g.analysis.moves.length);
  if (analysed.length < 3) return null;
  // Keep it quick: the most recent 300 reviewed games are enough to describe a style.
  const recent = [...analysed].sort((a, b) => b.playedAt - a.playedAt).slice(0, 300);
  const feats = recent.map(gameFeatures);
  const userMoves = feats.reduce((s, f) => s + f.moves, 0) || 1;

  // ---------------------------------------------------------------- style
  const captureRate = feats.reduce((s, f) => s + f.captures, 0) / userMoves;
  const checkRate = feats.reduce((s, f) => s + f.checks, 0) / userMoves;
  const kingRate = feats.reduce((s, f) => s + f.kingZone, 0) / userMoves;
  const sacrifices = feats.flatMap((f, i) => f.sacrifices.map((s) => ({ ...s, game: recent[i] })));
  const sacPerGame = sacrifices.length / recent.length;

  // Average absolute eval swing between consecutive positions, in pawns (capped).
  const swings = recent.map((g) => {
    const e = g.analysis!.evals.map((v) => clamp(v, -800, 800));
    let s = 0;
    for (let i = 1; i < e.length; i++) s += Math.abs(e[i] - e[i - 1]);
    return e.length > 1 ? s / (e.length - 1) / 100 : 0;
  });
  const accuracy = avg(recent.map((g) => g.analysis!.accuracy));
  const blunders = avg(recent.map((g) => g.analysis!.moves.filter((m) => m.cls === "blunder").length));
  const endgameShare =
    recent.filter((g) => g.analysis!.moves.some((m) => m.phase === "endgame")).length / recent.length;
  const endAcc = profile.accuracyByPhase.endgame ?? accuracy;
  const draws = games.length ? games.filter((g) => g.result === "draw").length / games.length : 0;

  const whiteFirst = feats.map((f) => f.firstMove).filter(Boolean) as string[];
  const firstCounts = new Map<string, number>();
  for (const m of whiteFirst) firstCounts.set(m, (firstCounts.get(m) ?? 0) + 1);
  const fav = [...firstCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const e4Share = whiteFirst.length ? (firstCounts.get("e4") ?? 0) / whiteFirst.length : 0.5;
  const gambits = recent.filter((g) => /gambit|attack|counter/i.test(g.opening)).length / recent.length;

  const style: Style = {
    aggression: clamp(
      ((captureRate - 0.12) / 0.16) * 0.5 + ((checkRate - 0.03) / 0.07) * 0.25 + ((kingRate - 0.08) / 0.15) * 0.25,
    ),
    sacrifice: clamp(sacPerGame / 0.6),
    chaos: clamp((avg(swings) - 0.3) / 1.2),
    precision: clamp((accuracy - 60) / 32 - blunders * 0.05),
    endgame: clamp(endgameShare * 0.6 + clamp((endAcc - 60) / 30) * 0.4),
    decisive: clamp(1 - draws / 0.3),
    openness: clamp(e4Share * 0.7 + gambits * 1.5),
  };

  // ---------------------------------------------------------------- legend
  const dims = Object.keys(style) as (keyof Style)[];
  const ranked = LEGENDS.map((l) => {
    const d = Math.sqrt(dims.reduce((s, k) => s + (style[k] - l.style[k]) ** 2, 0) / dims.length);
    return { l, d };
  }).sort((a, b) => a.d - b.d);
  const match = Math.round(clamp(1 - ranked[0].d * 1.4, 0.35, 0.98) * 100);

  // ---------------------------------------------------------------- score
  const winning = recent.filter((g) => g.analysis!.peakWin >= 80);
  const conversion = winning.length ? winning.filter((g) => g.result === "win").length / winning.length : 0.6;
  const accs = recent.map((g) => g.analysis!.accuracy);
  const sd = Math.sqrt(avg(accs.map((a) => (a - accuracy) ** 2)));
  const scoreParts: ScorePart[] = [
    { label: "Accuracy", value: clamp((accuracy - 50) / 45) * 100, weight: 0.45 },
    { label: "Blunder control", value: clamp(1 - blunders / 3) * 100, weight: 0.25 },
    { label: "Converting wins", value: conversion * 100, weight: 0.15 },
    { label: "Consistency", value: clamp(1 - sd / 20) * 100, weight: 0.15 },
  ].map((p) => ({ ...p, value: Math.round(p.value) }));
  const score = Math.round(scoreParts.reduce((s, p) => s + p.value * p.weight, 0));

  // ---------------------------------------------------------------- moments
  let costliest: Story["costliest"];
  for (const g of recent) {
    for (const m of g.analysis!.moves) {
      if (m.cls !== "blunder" && m.cls !== "mistake") continue;
      const lostGame = g.result !== "win";
      // A blunder that threw a game counts more than one in a game you won anyway.
      const weight = m.winDrop * (lostGame ? 1.3 : 0.8);
      const best = costliest ? costliest.move.winDrop * (costliest.lostGame ? 1.3 : 0.8) : -1;
      if (weight > best) {
        const sign = g.userColor === "w" ? 1 : -1;
        const winBefore = winChance(sign * (g.analysis!.evals[m.ply] ?? 0));
        costliest = { game: g, move: m, lostGame, wasWinning: winBefore >= 70, winBefore: Math.round(winBefore) };
      }
    }
  }
  const brilliantSac = sacrifices.sort((a, b) => b.gain - a.gain || b.game.playedAt - a.game.playedAt)[0];
  const wins = recent.filter((g) => g.result === "win" && g.analysis!.moves.length >= 15);
  const finest = wins.sort((a, b) => b.analysis!.accuracy - a.analysis!.accuracy)[0];
  const longestGame = [...recent].sort((a, b) => b.analysis!.evals.length - a.analysis!.evals.length)[0];

  const ops = profile.openings.filter((o) => o.games >= 4 && o.name !== "Unknown opening");
  const bestOpening = [...ops].sort((a, b) => b.score - a.score)[0];
  const worstOpening = [...ops].sort((a, b) => a.score - b.score)[0];

  return {
    games: games.length,
    analysed: analysed.length,
    score,
    tier: tierFor(score),
    scoreParts,
    style,
    legend: ranked[0].l,
    match,
    runnerUp: ranked[1].l,
    costliest,
    brilliant: brilliantSac ? { game: brilliantSac.game, move: brilliantSac.move } : undefined,
    finest,
    bestOpening,
    worstOpening: worstOpening && worstOpening !== bestOpening ? worstOpening : undefined,
    sacrifices: sacrifices.length,
    longestGame,
    favouriteFirstMove: fav ? { san: fav[0], share: Math.round((fav[1] / whiteFirst.length) * 100) } : undefined,
  };
}
