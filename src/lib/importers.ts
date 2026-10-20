import { Chess } from "chess.js";
import type { Account } from "./db";
import type { Color, Result, Speed, StoredGame } from "./types";

export interface ImportProgress {
  /** Games saved so far in this run. */
  count: number;
  message: string;
}

type Emit = (games: StoredGame[], progress: ImportProgress) => Promise<void>;

const accountKey = (source: string, username: string) => `${source}:${username.toLowerCase()}`;

// ---------------------------------------------------------------- Lichess

interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  winner?: "white" | "black";
  players: {
    white: { user?: { name: string }; rating?: number; aiLevel?: number };
    black: { user?: { name: string }; rating?: number; aiLevel?: number };
  };
  opening?: { eco: string; name: string };
  pgn: string;
}

function lichessSpeed(s: string): Speed {
  if (s === "bullet" || s === "ultraBullet") return "bullet";
  if (s === "blitz" || s === "rapid" || s === "classical") return s;
  if (s === "correspondence") return "daily";
  return "unknown";
}

/**
 * Streams the whole game history of a Lichess user (oldest first), or only games newer
 * than the account cursor on later syncs.
 */
export async function importLichess(account: Account, emit: Emit, signal: AbortSignal) {
  const since = typeof account.cursor === "number" ? account.cursor + 1 : undefined;
  const params = new URLSearchParams({
    pgnInJson: "true",
    opening: "true",
    clocks: "true",
    sort: "dateAsc",
  });
  if (since) params.set("since", String(since));
  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(account.username)}?${params}`,
    { headers: { Accept: "application/x-ndjson" }, signal },
  );
  if (res.status === 404) throw new Error(`Lichess user "${account.username}" not found.`);
  if (res.status === 429) throw new Error("Lichess is rate limiting us. Wait a minute and try again.");
  if (!res.ok || !res.body) throw new Error(`Lichess returned ${res.status}.`);

  const me = account.username.toLowerCase();
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let count = 0;
  let batch: StoredGame[] = [];
  let newest = typeof account.cursor === "number" ? account.cursor : 0;

  const flush = async () => {
    count += batch.length;
    account.cursor = newest;
    await emit(batch, { count, message: `Downloaded ${count} Lichess games…` });
    batch = [];
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      const g = JSON.parse(line) as LichessGame;
      newest = Math.max(newest, g.createdAt);
      if (g.variant !== "standard" && g.variant !== "fromPosition") continue;
      const whiteName = g.players.white.user?.name ?? (g.players.white.aiLevel ? `Stockfish level ${g.players.white.aiLevel}` : "Anonymous");
      const blackName = g.players.black.user?.name ?? (g.players.black.aiLevel ? `Stockfish level ${g.players.black.aiLevel}` : "Anonymous");
      const userColor: Color = whiteName.toLowerCase() === me ? "w" : "b";
      const result: Result = !g.winner
        ? "draw"
        : (g.winner === "white") === (userColor === "w")
          ? "win"
          : "loss";
      const user = userColor === "w" ? g.players.white : g.players.black;
      const opp = userColor === "w" ? g.players.black : g.players.white;
      if (!g.pgn || !/\d\.\s/.test(g.pgn)) continue; // aborted before any move
      batch.push({
        id: `lichess:${g.id}`,
        source: "lichess",
        account: account.id,
        url: `https://lichess.org/${g.id}`,
        pgn: g.pgn,
        white: whiteName,
        black: blackName,
        userColor,
        result,
        userRating: user.rating,
        opponentRating: opp.rating,
        opening: g.opening?.name ?? "Unknown opening",
        eco: g.opening?.eco,
        speed: lichessSpeed(g.speed),
        rated: g.rated,
        playedAt: g.lastMoveAt ?? g.createdAt,
      });
      if (batch.length >= 200) await flush();
    }
    if (done) break;
  }
  await flush();
}

// ---------------------------------------------------------------- Chess.com

interface ChesscomPlayer {
  username: string;
  rating: number;
  result: string;
}
interface ChesscomGame {
  url: string;
  uuid?: string;
  pgn?: string;
  time_class: string;
  rules: string;
  rated: boolean;
  end_time: number;
  eco?: string;
  white: ChesscomPlayer;
  black: ChesscomPlayer;
}

const CHESSCOM_DRAWS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

function chesscomOpening(g: ChesscomGame): { name: string; eco?: string } {
  const header = (tag: string) => g.pgn?.match(new RegExp(`\\[${tag} "([^"]*)"\\]`))?.[1];
  const ecoUrl = g.eco ?? header("ECOUrl");
  const slug = ecoUrl?.split("/openings/")[1];
  const name = slug
    ? decodeURIComponent(slug)
        .replace(/-\d.*$/, "") // drop the move list Chess.com appends
        .replace(/-/g, " ")
    : "Unknown opening";
  return { name, eco: header("ECO") };
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (res.status === 404) throw new Error("not-found");
    if (!res.ok) throw new Error(`Chess.com returned ${res.status}.`);
    return res.json() as Promise<T>;
  }
}

/**
 * Walks every monthly archive of a Chess.com user. On later syncs it starts again from the
 * last month that was synced, since that month may have gained games.
 */
export async function importChesscom(account: Account, emit: Emit, signal: AbortSignal) {
  const user = encodeURIComponent(account.username.toLowerCase());
  let archives: string[];
  try {
    archives = (
      await getJson<{ archives: string[] }>(`https://api.chess.com/pub/player/${user}/games/archives`, signal)
    ).archives;
  } catch (e) {
    if ((e as Error).message === "not-found") throw new Error(`Chess.com user "${account.username}" not found.`);
    throw e;
  }
  const monthOf = (url: string) => url.split("/games/")[1]; // "YYYY/MM"
  const cursor = typeof account.cursor === "string" ? account.cursor : "";
  const todo = archives.filter((a) => monthOf(a) >= cursor);
  const me = account.username.toLowerCase();
  let count = 0;

  for (let i = 0; i < todo.length; i++) {
    const { games } = await getJson<{ games: ChesscomGame[] }>(todo[i], signal);
    const batch: StoredGame[] = [];
    for (const g of games) {
      if (g.rules !== "chess" || !g.pgn) continue;
      const userColor: Color = g.white.username.toLowerCase() === me ? "w" : "b";
      const mine = userColor === "w" ? g.white : g.black;
      const opp = userColor === "w" ? g.black : g.white;
      const result: Result =
        mine.result === "win" ? "win" : CHESSCOM_DRAWS.has(mine.result) ? "draw" : "loss";
      const { name, eco } = chesscomOpening(g);
      const id = g.uuid ?? g.url.split("/").pop()!;
      batch.push({
        id: `chesscom:${id}`,
        source: "chesscom",
        account: account.id,
        url: g.url,
        pgn: g.pgn,
        white: g.white.username,
        black: g.black.username,
        userColor,
        result,
        userRating: mine.rating,
        opponentRating: opp.rating,
        opening: name,
        eco,
        speed: (["bullet", "blitz", "rapid", "daily"].includes(g.time_class) ? g.time_class : "unknown") as Speed,
        rated: g.rated,
        playedAt: g.end_time * 1000,
      });
    }
    count += batch.length;
    account.cursor = monthOf(todo[i]);
    await emit(batch, {
      count,
      message: `Chess.com: month ${i + 1} of ${todo.length} (${monthOf(todo[i])}), ${count} games so far…`,
    });
  }
}

// ---------------------------------------------------------------- PGN paste

/** Splits pasted text into games. `you` picks your side by matching player names. */
export function parsePgnText(text: string, you: string): StoredGame[] {
  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/\n(?=\[Event )/)
    .map((c) => c.trim())
    .filter(Boolean);
  const me = you.trim().toLowerCase();
  const out: StoredGame[] = [];
  for (const pgn of chunks) {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch {
      continue;
    }
    if (!chess.history().length) continue;
    const h = chess.getHeaders();
    const white = h.White ?? "White";
    const black = h.Black ?? "Black";
    const userColor: Color = me && black.toLowerCase() === me ? "b" : "w";
    const res = h.Result;
    const result: Result =
      res === "1/2-1/2" ? "draw" : res === (userColor === "w" ? "1-0" : "0-1") ? "win" : res === "*" ? "draw" : "loss";
    const date = h.UTCDate ?? h.Date;
    const playedAt = date ? Date.parse(date.replace(/\./g, "-")) || Date.now() : Date.now();
    out.push({
      id: `pgn:${hash(pgn)}`,
      source: "pgn",
      account: accountKey("pgn", me || "pasted"),
      pgn,
      white,
      black,
      userColor,
      result,
      opening: h.Opening ?? "Unknown opening",
      eco: h.ECO,
      speed: "unknown",
      rated: false,
      playedAt,
    });
  }
  return out;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export { accountKey };
