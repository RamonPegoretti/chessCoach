// Analyze a PGN file from the command line with the same code the app uses.
// Usage: npx tsx scripts/analyze-pgn.mts game.pgn [w|b] [depth]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { UciEvaluator } from "../src/lib/engine";
import { analyzeGame } from "../src/lib/analysis";

const require = createRequire(import.meta.url);
const [file, color = "w", depth = "10"] = process.argv.slice(2);
const lines: { receive?: (line: string) => void } = {};
const sf = require("stockfish")("lite-single", (line: string) => lines.receive?.(line));
const evaluator = new UciEvaluator((cmd) => sf.processCommand(cmd));
lines.receive = (line) => evaluator.receive(line);

const result = await analyzeGame(readFileSync(file, "utf8"), color as "w" | "b", evaluator, {
  depth: Number(depth),
});
for (const m of result!.moves) {
  if (m.cls === "best" || m.cls === "good") continue;
  console.log(`${Math.floor(m.ply / 2) + 1}. ${m.san} -> ${m.cls} (best ${m.bestSan}, -${m.winDrop}%) [${m.motif}] ${m.explanation}`);
}
console.log("accuracy", result!.accuracy, "peak", result!.peakWin);
sf.terminate?.();
process.exit(0);
