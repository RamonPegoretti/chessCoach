// Copies the Stockfish WASM engine from node_modules into public/ so the browser can load it
// as a Web Worker. Runs on every install (locally and on Vercel).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bin = join(dirname(require.resolve("stockfish/package.json")), "bin");
const out = join(import.meta.dirname, "..", "public", "engine");
mkdirSync(out, { recursive: true });
for (const f of ["stockfish-19-lite-single.js", "stockfish-19-lite-single.wasm"]) {
  copyFileSync(join(bin, f), join(out, f));
}
console.log("Copied Stockfish engine to public/engine");
