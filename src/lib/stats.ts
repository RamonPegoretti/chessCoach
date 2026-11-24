import { Chess } from "chess.js";
import type { Color, Result, Speed, StoredGame } from "./types";

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export type ColorFilter = "all" | Color;
export type Period = "30" | "90" | "365" | "all";

export interface StatsFilter {
  speed: Speed | "all";
  color: ColorFilter;
  account: string | "all";
  period: Period;
  ratedOnly: boolean;
}

export const SPEED_ORDER: Speed[] = ["bullet", "blitz", "rapid", "classical", "daily", "unknown"];
export const SPEED_LABEL: Record<Speed, string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
  daily: "Daily",
  unknown: "Other",
};

const DAY = 86_400_000;

/** Every filter except speed, so the rating cards can show all time controls at once. */
export function filterGames(games: StoredGame[], f: StatsFilter, opts: { ignoreSpeed?: boolean } = {}) {
  const since = f.period === "all" ? 0 : Date.now() - Number(f.period) * DAY;
  return games
    .filter(
      (g) =>
        (opts.ignoreSpeed || f.speed === "all" || g.speed === f.speed) &&
        (f.color === "all" || g.userColor === f.color) &&
        (f.account === "all" || g.account === f.account) &&
        (!f.ratedOnly || g.rated) &&
        g.playedAt >= since,
    )
    .sort((a, b) => a.playedAt - b.playedAt);
}

/* ------------------------------------------------------------------ */
/* Per-game facts parsed from the PGN (cached)                          */
/* ------------------------------------------------------------------ */

export type Ending =
  | "checkmate"
  | "resignation"
  | "timeout"
  | "abandoned"
  | "agreement"
  | "repetition"
  | "stalemate"
  | "insufficient"
  | "fifty-move"
  | "timeout-insufficient"
  | "other";

export const ENDING_LABEL: Record<Ending, string> = {
  checkmate: "Checkmate",
  resignation: "Resignation",
  timeout: "Time",
  abandoned: "Abandoned",
  agreement: "Agreement",
  repetition: "Repetition",
  stalemate: "Stalemate",
  insufficient: "Insufficient material",
  "fifty-move": "50-move rule",
  "timeout-insufficient": "Time vs insufficient material",
  other: "Other",
};

interface Facts {
  ending: Ending;
  /** Full moves played (rounded up). */
  moves: number;
}

const factsCache = new Map<string, Facts>();

function header(pgn: string, tag: string) {
  return new RegExp(`\\[${tag} "([^"]*)"\\]`).exec(pgn)?.[1] ?? "";
}

function movetext(pgn: string) {
  return pgn
    .replace(/^\s*\[[^\]]*\]\s*$/gm, "")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\$\d+/g, " ");
}

function sanTokens(pgn: string) {
  return movetext(pgn)
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
    .map((t) => t.replace(/^\d+\.+/, ""))
    .filter(Boolean);
}

function classify(g: StoredGame, sans: string[]): Ending {
  const term = header(g.pgn, "Termination").toLowerCase();
  const lastIsMate = sans.length > 0 && sans[sans.length - 1].includes("#");

  // Chess.com style: "X won by resignation", "Game drawn by repetition".
  if (term.includes("checkmate")) return "checkmate";
  if (term.includes("resignation")) return "resignation";
  if (term.includes("abandon")) return "abandoned";
  if (term.includes("timeout vs insufficient") || (g.result === "draw" && term.includes("time")))
    return "timeout-insufficient";
  if (term.includes("on time") || term.includes("time forfeit")) return "timeout";
  if (term.includes("agreement")) return "agreement";
  if (term.includes("repetition")) return "repetition";
  if (term.includes("stalemate")) return "stalemate";
  if (term.includes("insufficient")) return "insufficient";
  if (term.includes("50-move") || term.includes("50 move")) return "fifty-move";

  // Lichess "Normal" and plain PGNs: work it out from the moves.
  if (g.result !== "draw") return lastIsMate ? "checkmate" : "resignation";
  try {
    const c = new Chess();
    for (const s of sans) c.move(s);
    if (c.isStalemate()) return "stalemate";
    if (c.isInsufficientMaterial()) return "insufficient";
    if (c.isThreefoldRepetition()) return "repetition";
    if (c.isDrawByFiftyMoves()) return "fifty-move";
    return "agreement";
  } catch {
    return "other";
  }
}

export function gameFacts(g: StoredGame): Facts {
  const hit = factsCache.get(g.id);
  if (hit) return hit;
  const sans = sanTokens(g.pgn);
  const facts = { ending: classify(g, sans), moves: Math.ceil(sans.length / 2) };
  factsCache.set(g.id, facts);
  return facts;
}

/* ------------------------------------------------------------------ */
/* Aggregates                                                          */
/* ------------------------------------------------------------------ */

export interface WDL {
  games: number;
  win: number;
  draw: number;
  loss: number;
}

const emptyWDL = (): WDL => ({ games: 0, win: 0, draw: 0, loss: 0 });
function add(r: WDL, res: Result) {
  r.games++;
  r[res]++;
}
/** Score in percent: wins + half the draws. */
export const score = (r: WDL) => (r.games ? ((r.win + r.draw / 2) / r.games) * 100 : 0);
export const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);

export interface RatingSummary {
  speed: Speed;
  games: number;
  current?: number;
  best?: { rating: number; at: number };
  lowest?: { rating: number; at: number };
  change30?: number;
  record: WDL;
}

export interface Streaks {
  longestWin: number;
  longestLoss: number;
  longestUnbeaten: number;
  current: { kind: Result; length: number } | null;
}

export interface OpeningRow extends WDL {
  name: string;
  eco?: string;
  accuracy?: number;
  analysed: number;
}

export interface Bucket extends WDL {
  label: string;
}

export interface Stats {
  total: WDL;
  byColor: Record<Color, WDL>;
  endings: Record<Result, { ending: Ending; count: number }[]>;
  streaks: Streaks;
  bestWins: StoredGame[];
  worstLosses: StoredGame[];
  vsStrength: Bucket[];
  avgOpponent?: number;
  openings: OpeningRow[];
  accuracy: {
    analysed: number;
    average?: number;
    byResult: Partial<Record<Result, number>>;
    bySpeed: { speed: Speed; accuracy: number; games: number }[];
    monthly: { month: number; accuracy: number; games: number }[];
  };
  monthly: { month: number; record: WDL }[];
  weekday: Bucket[];
  hour: Bucket[];
  length: {
    byResult: Partial<Record<Result, number>>;
    shortestWin?: { game: StoredGame; moves: number };
    longestGame?: { game: StoredGame; moves: number };
    buckets: Bucket[];
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const monthStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
};

export function ratingSummaries(games: StoredGame[]): RatingSummary[] {
  const now = Date.now();
  const out: RatingSummary[] = [];
  for (const speed of SPEED_ORDER) {
    const list = games.filter((g) => g.speed === speed);
    if (!list.length) continue;
    const s: RatingSummary = { speed, games: list.length, record: emptyWDL() };
    let before30: number | undefined;
    for (const g of list) {
      add(s.record, g.result);
      const r = g.userRating;
      if (!r || !g.rated) continue;
      s.current = r;
      if (!s.best || r > s.best.rating) s.best = { rating: r, at: g.playedAt };
      if (!s.lowest || r < s.lowest.rating) s.lowest = { rating: r, at: g.playedAt };
      if (g.playedAt < now - 30 * DAY) before30 = r;
    }
    if (s.current !== undefined && before30 !== undefined) s.change30 = s.current - before30;
    out.push(s);
  }
  return out;
}

function streaks(games: StoredGame[]): Streaks {
  let longestWin = 0,
    longestLoss = 0,
    longestUnbeaten = 0,
    w = 0,
    l = 0,
    u = 0;
  for (const g of games) {
    w = g.result === "win" ? w + 1 : 0;
    l = g.result === "loss" ? l + 1 : 0;
    u = g.result !== "loss" ? u + 1 : 0;
    longestWin = Math.max(longestWin, w);
    longestLoss = Math.max(longestLoss, l);
    longestUnbeaten = Math.max(longestUnbeaten, u);
  }
  let current: Streaks["current"] = null;
  if (games.length) {
    const kind = games[games.length - 1].result;
    let length = 0;
    for (let i = games.length - 1; i >= 0 && games[i].result === kind; i--) length++;
    current = { kind, length };
  }
  return { longestWin, longestLoss, longestUnbeaten, current };
}

const STRENGTH = [
  { label: "200+ lower", lo: -Infinity, hi: -200 },
  { label: "50–200 lower", lo: -200, hi: -50 },
  { label: "Within 50", lo: -50, hi: 50 },
  { label: "50–200 higher", lo: 50, hi: 200 },
  { label: "200+ higher", lo: 200, hi: Infinity },
];

const LENGTHS = [
  { label: "≤ 20", lo: 0, hi: 20 },
  { label: "21–30", lo: 21, hi: 30 },
  { label: "31–40", lo: 31, hi: 40 },
  { label: "41–60", lo: 41, hi: 60 },
  { label: "61+", lo: 61, hi: Infinity },
];

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function buildStats(games: StoredGame[]): Stats {
  const total = emptyWDL();
  const byColor = { w: emptyWDL(), b: emptyWDL() };
  const endingCounts: Record<Result, Map<Ending, number>> = { win: new Map(), draw: new Map(), loss: new Map() };
  const vsStrength = STRENGTH.map((b) => ({ ...emptyWDL(), label: b.label }));
  const openings = new Map<string, OpeningRow & { accs: number[] }>();
  const accAll: number[] = [];
  const accByResult: Record<Result, number[]> = { win: [], draw: [], loss: [] };
  const accBySpeed = new Map<Speed, number[]>();
  const accMonthly = new Map<number, number[]>();
  const monthly = new Map<number, WDL>();
  const weekday = WEEKDAYS.map((label) => ({ ...emptyWDL(), label }));
  const hour = Array.from({ length: 24 }, (_, h) => ({ ...emptyWDL(), label: String(h) }));
  const lenByResult: Record<Result, number[]> = { win: [], draw: [], loss: [] };
  const lenBuckets = LENGTHS.map((b) => ({ ...emptyWDL(), label: b.label }));
  let shortestWin: Stats["length"]["shortestWin"];
  let longestGame: Stats["length"]["longestGame"];
  const oppRatings: number[] = [];

  for (const g of games) {
    add(total, g.result);
    add(byColor[g.userColor], g.result);

    const facts = gameFacts(g);
    const ec = endingCounts[g.result];
    ec.set(facts.ending, (ec.get(facts.ending) ?? 0) + 1);

    if (g.userRating && g.opponentRating) {
      const diff = g.opponentRating - g.userRating;
      const i = STRENGTH.findIndex((b) => diff >= b.lo && diff < b.hi);
      add(vsStrength[i === -1 ? STRENGTH.length - 1 : i], g.result);
    }
    if (g.opponentRating) oppRatings.push(g.opponentRating);

    const key = g.opening || "Unknown opening";
    let row = openings.get(key);
    if (!row) {
      row = { ...emptyWDL(), name: key, eco: g.eco, analysed: 0, accs: [] };
      openings.set(key, row);
    }
    add(row, g.result);

    const acc = g.analysis?.accuracy;
    if (typeof acc === "number" && Number.isFinite(acc)) {
      accAll.push(acc);
      accByResult[g.result].push(acc);
      if (!accBySpeed.has(g.speed)) accBySpeed.set(g.speed, []);
      accBySpeed.get(g.speed)!.push(acc);
      const m = monthStart(g.playedAt);
      if (!accMonthly.has(m)) accMonthly.set(m, []);
      accMonthly.get(m)!.push(acc);
      row.accs.push(acc);
      row.analysed++;
    }

    const m = monthStart(g.playedAt);
    if (!monthly.has(m)) monthly.set(m, emptyWDL());
    add(monthly.get(m)!, g.result);

    const d = new Date(g.playedAt);
    add(weekday[(d.getDay() + 6) % 7], g.result);
    add(hour[d.getHours()], g.result);

    if (facts.moves > 0) {
      lenByResult[g.result].push(facts.moves);
      const li = LENGTHS.findIndex((b) => facts.moves >= b.lo && facts.moves <= b.hi);
      add(lenBuckets[li], g.result);
      if (g.result === "win" && (!shortestWin || facts.moves < shortestWin.moves))
        shortestWin = { game: g, moves: facts.moves };
      if (!longestGame || facts.moves > longestGame.moves) longestGame = { game: g, moves: facts.moves };
    }
  }

  const sortEnd = (m: Map<Ending, number>) =>
    [...m].map(([ending, count]) => ({ ending, count })).sort((a, b) => b.count - a.count);

  const rated = games.filter((g) => g.opponentRating);
  const byOpp = (dir: 1 | -1, res: Result) =>
    rated
      .filter((g) => g.result === res && g.rated)
      .sort((a, b) => dir * ((b.opponentRating ?? 0) - (a.opponentRating ?? 0)))
      .slice(0, 5);

  return {
    total,
    byColor,
    endings: { win: sortEnd(endingCounts.win), draw: sortEnd(endingCounts.draw), loss: sortEnd(endingCounts.loss) },
    streaks: streaks(games),
    bestWins: byOpp(1, "win"),
    worstLosses: byOpp(-1, "loss"),
    vsStrength,
    avgOpponent: avg(oppRatings),
    openings: [...openings.values()]
      .map(({ accs, ...r }) => ({ ...r, accuracy: avg(accs) }))
      .sort((a, b) => b.games - a.games),
    accuracy: {
      analysed: accAll.length,
      average: avg(accAll),
      byResult: {
        win: avg(accByResult.win),
        draw: avg(accByResult.draw),
        loss: avg(accByResult.loss),
      },
      bySpeed: SPEED_ORDER.filter((s) => accBySpeed.has(s)).map((speed) => ({
        speed,
        accuracy: avg(accBySpeed.get(speed)!)!,
        games: accBySpeed.get(speed)!.length,
      })),
      monthly: [...accMonthly]
        .sort((a, b) => a[0] - b[0])
        .map(([month, xs]) => ({ month, accuracy: avg(xs)!, games: xs.length })),
    },
    monthly: [...monthly].sort((a, b) => a[0] - b[0]).map(([month, record]) => ({ month, record })),
    weekday,
    hour,
    length: {
      byResult: { win: avg(lenByResult.win), draw: avg(lenByResult.draw), loss: avg(lenByResult.loss) },
      shortestWin,
      longestGame,
      buckets: lenBuckets,
    },
  };
}

export type Site = "chesscom" | "lichess" | "pgn";
export const SITES: { id: Site; label: string }[] = [
  { id: "chesscom", label: "Chess.com" },
  { id: "lichess", label: "Lichess" },
  { id: "pgn", label: "Imported PGN" },
];

/** Rating history per time control. Ratings from different sites are not comparable, so call this per site. */
export function ratingSeries(games: StoredGame[]) {
  const series = new Map<Speed, { t: number; r: number }[]>();
  for (const g of games) {
    if (!g.rated || !g.userRating) continue;
    if (!series.has(g.speed)) series.set(g.speed, []);
    series.get(g.speed)!.push({ t: g.playedAt, r: g.userRating });
  }
  return SPEED_ORDER.filter((s) => series.has(s)).map((speed) => ({ speed, points: thinOut(series.get(speed)!) }));
}

/** Keep the last rating of each day so long histories stay light to draw. */
function thinOut(points: { t: number; r: number }[]) {
  const byDay = new Map<number, { t: number; r: number }>();
  for (const p of points) byDay.set(Math.floor(p.t / DAY), p);
  return [...byDay.values()];
}
