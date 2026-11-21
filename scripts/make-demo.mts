// Builds public/demo-games.json: engine-vs-engine games with human-like noise, already reviewed,
// so visitors can try the app without importing an account.
// Usage: npx tsx scripts/make-demo.mts [games] [depth]
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Chess } from "chess.js";
import { UciEvaluator } from "../src/lib/engine";
import { analyzeGame } from "../src/lib/analysis";
import type { StoredGame } from "../src/lib/types";

const require = createRequire(import.meta.url);
const [nGames = "36", depth = "9"] = process.argv.slice(2);
const lines: { receive?: (line: string) => void } = {};
const sf = require("stockfish")("lite-single", (line: string) => lines.receive?.(line));
const engine = new UciEvaluator((cmd) => sf.processCommand(cmd));
lines.receive = (line) => engine.receive(line);

const OPENINGS: { name: string; eco: string; moves: string[] }[] = [
  { name: "Italian Game", eco: "C50", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"] },
  { name: "King's Gambit", eco: "C33", moves: ["e4", "e5", "f4", "exf4", "Nf3"] },
  {
    name: "Sicilian Defense: Najdorf",
    eco: "B90",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
  },
  { name: "Queen's Gambit Declined", eco: "D30", moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"] },
  { name: "French Defense", eco: "C00", moves: ["e4", "e6", "d4", "d5", "Nc3"] },
  { name: "King's Indian Defense", eco: "E60", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"] },
  { name: "Scotch Game", eco: "C45", moves: ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "Nxd4"] },
  { name: "Caro-Kann Defense", eco: "B10", moves: ["e4", "c6", "d4", "d5"] },
];
const OPPONENTS = [
  "kniightrider",
  "pawnstorm88",
  "e4enjoyer",
  "quietbishop",
  "zugzwanged",
  "tactico",
  "rookie_rook",
  "castlelong",
];

const rnd = (n: number) => Math.floor(Math.random() * n);

async function playGame(i: number): Promise<StoredGame> {
  const opening = OPENINGS[i % OPENINGS.length];
  const userColor = i % 2 ? "b" : "w";
  const chess = new Chess();
  for (const m of opening.moves) chess.move(m);
  engine.newGame();
  // Some days you're sharp, some days you're not.
  const userNoise = 0.05 + Math.random() * 0.08;
  while (!chess.isGameOver() && chess.history().length < 130) {
    const userTurn = chess.turn() === userColor;
    // The "user" is a bit stronger than the opponents but blunders sometimes.
    const noise = userTurn ? userNoise : 0.08;
    const legal = chess.moves();
    if (Math.random() < noise) {
      chess.move(legal[rnd(legal.length)]);
      continue;
    }
    const r = await engine.evaluate(chess.fen(), userTurn ? 2 + rnd(5) : 2 + rnd(4));
    if (!r.bestmove) break;
    chess.move({ from: r.bestmove.slice(0, 2), to: r.bestmove.slice(2, 4), promotion: r.bestmove[4] });
  }
  let result: StoredGame["result"] = "draw";
  let pgnResult = "1/2-1/2";
  if (chess.isCheckmate()) {
    const loser = chess.turn();
    result = loser === userColor ? "loss" : "win";
    pgnResult = loser === "w" ? "0-1" : "1-0";
  } else if (!chess.isGameOver()) {
    // Adjudicate long games by engine eval.
    const r = await engine.evaluate(chess.fen(), 10);
    const white = chess.turn() === "w" ? r.score : -r.score;
    if (Math.abs(white) > 250) {
      pgnResult = white > 0 ? "1-0" : "0-1";
      result = white > 0 === (userColor === "w") ? "win" : "loss";
    }
  }
  const opp = OPPONENTS[i % OPPONENTS.length];
  const white = userColor === "w" ? "You" : opp;
  const black = userColor === "w" ? opp : "You";
  const playedAt = Date.now() - (Number(nGames) - i) * 86400000 * 2;
  chess.header("White", white, "Black", black, "Result", pgnResult, "Opening", opening.name, "ECO", opening.eco);
  const pgn = chess.pgn();
  const userRating = 1450 + i * 6 + rnd(40);
  const g: StoredGame = {
    id: `pgn:demo-${i}`,
    source: "pgn",
    account: "demo",
    pgn,
    white,
    black,
    userColor,
    result,
    userRating,
    opponentRating: userRating - 60 + rnd(120),
    opening: opening.name,
    eco: opening.eco,
    speed: "rapid",
    rated: true,
    playedAt,
  };
  g.analysis = (await analyzeGame(pgn, userColor, engine, { depth: Number(depth) })) ?? undefined;
  return g;
}

const games: StoredGame[] = [];
for (let i = 0; i < Number(nGames); i++) {
  games.push(await playGame(i));
  console.log(`game ${i + 1}/${nGames}: ${games[i].result}, acc ${games[i].analysis?.accuracy}`);
}
writeFileSync("public/demo-games.json", JSON.stringify(games));
console.log("wrote public/demo-games.json");
sf.terminate?.();
process.exit(0);
