import type { Motif, Phase, ReviewedMove, Speed, StoredGame } from "./types";

export interface Record3 {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Points per game, 0-100. */
  score: number;
}

export interface OpeningStat extends Record3 {
  name: string;
  color: "w" | "b";
}

export interface Profile {
  total: Record3;
  byColor: Record<"w" | "b", Record3>;
  bySpeed: Partial<Record<Speed, Record3>>;
  openings: OpeningStat[];
  rating: { t: number; r: number; speed: Speed }[];
  analysed: number;
  accuracy?: number;
  accuracyByPhase: Partial<Record<Phase, number>>;
  /** Mistakes + blunders per game, per phase. */
  errorsByPhase: Partial<Record<Phase, number>>;
  blundersPerGame?: number;
  motifs: { motif: Motif; count: number; perGame: number }[];
  /** Error rate (mistake or blunder per move) with under 30s on the clock vs. otherwise. */
  timeTrouble?: { lowRate: number; normalRate: number; lowMoves: number };
  /** Games where you reached >= 80% win chance but didn't win. */
  thrownWins: { count: number; of: number };
}

function rec(games: StoredGame[]): Record3 {
  const wins = games.filter((g) => g.result === "win").length;
  const draws = games.filter((g) => g.result === "draw").length;
  const losses = games.length - wins - draws;
  return {
    games: games.length,
    wins,
    draws,
    losses,
    score: games.length ? Math.round(((wins + draws / 2) / games.length) * 100) : 0,
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const isError = (m: ReviewedMove) => m.cls === "mistake" || m.cls === "blunder";

export function buildProfile(games: StoredGame[]): Profile {
  const byColor = {
    w: rec(games.filter((g) => g.userColor === "w")),
    b: rec(games.filter((g) => g.userColor === "b")),
  };
  const bySpeed: Profile["bySpeed"] = {};
  for (const s of new Set(games.map((g) => g.speed))) bySpeed[s] = rec(games.filter((g) => g.speed === s));

  // Openings, grouped by family name ("Sicilian Defense: Najdorf" -> "Sicilian Defense") and colour.
  const groups = new Map<string, StoredGame[]>();
  for (const g of games) {
    const family = g.opening.split(/[:,]/)[0].trim();
    const key = `${g.userColor}|${family}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }
  const openings: OpeningStat[] = [...groups.entries()]
    .map(([key, gs]) => ({ name: key.split("|")[1], color: key[0] as "w" | "b", ...rec(gs) }))
    .sort((a, b) => b.games - a.games);

  const rating = games
    .filter((g) => g.rated && g.userRating)
    .map((g) => ({ t: g.playedAt, r: g.userRating!, speed: g.speed }))
    .sort((a, b) => a.t - b.t);

  const analysedGames = games.filter((g) => g.analysis);
  const moves = analysedGames.flatMap((g) => g.analysis!.moves);
  const phases: Phase[] = ["opening", "middlegame", "endgame"];
  const accuracyByPhase: Profile["accuracyByPhase"] = {};
  const errorsByPhase: Profile["errorsByPhase"] = {};
  for (const p of phases) {
    const pm = moves.filter((m) => m.phase === p);
    if (pm.length < 10) continue;
    accuracyByPhase[p] = Math.round(avg(pm.map((m) => m.accuracy))! * 10) / 10;
    errorsByPhase[p] = Math.round((pm.filter(isError).length / analysedGames.length) * 100) / 100;
  }

  const motifCounts = new Map<Motif, number>();
  for (const m of moves) {
    if (m.motif && isError(m)) motifCounts.set(m.motif, (motifCounts.get(m.motif) ?? 0) + 1);
  }
  const motifs = [...motifCounts.entries()]
    .map(([motif, count]) => ({
      motif,
      count,
      perGame: Math.round((count / Math.max(1, analysedGames.length)) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count);

  const clocked = moves.filter((m) => m.clock !== undefined);
  const low = clocked.filter((m) => m.clock! < 30);
  const normal = clocked.filter((m) => m.clock! >= 30);
  const timeTrouble =
    low.length >= 20 && normal.length >= 20
      ? {
          lowRate: low.filter(isError).length / low.length,
          normalRate: normal.filter(isError).length / normal.length,
          lowMoves: low.length,
        }
      : undefined;

  const winning = analysedGames.filter((g) => g.analysis!.peakWin >= 80);
  return {
    total: rec(games),
    byColor,
    bySpeed,
    openings,
    rating,
    analysed: analysedGames.length,
    accuracy: analysedGames.length
      ? Math.round(avg(analysedGames.map((g) => g.analysis!.accuracy))! * 10) / 10
      : undefined,
    accuracyByPhase,
    errorsByPhase,
    blundersPerGame: analysedGames.length
      ? Math.round((moves.filter((m) => m.cls === "blunder").length / analysedGames.length) * 100) / 100
      : undefined,
    motifs,
    timeTrouble,
    thrownWins: { count: winning.filter((g) => g.result !== "win").length, of: winning.length },
  };
}
