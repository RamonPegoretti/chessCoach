import { MATE_SCORE } from "./types";

export interface EngineResult {
  /** Score from the side to move's point of view, centipawns (mate encoded). */
  score: number;
  bestmove: string;
}

/** Anything that can evaluate a FEN. Lets the analysis run in the browser or in Node tests. */
export interface Evaluator {
  evaluate(fen: string, depth: number): Promise<EngineResult>;
  newGame(): void;
}

export function parseScore(line: string): number | null {
  const m = line.match(/ score (cp|mate) (-?\d+)/);
  if (!m) return null;
  const v = parseInt(m[2], 10);
  if (m[1] === "cp") return v;
  if (v === 0) return -MATE_SCORE;
  return v > 0 ? MATE_SCORE - v : -MATE_SCORE - v;
}

/**
 * Speaks UCI to anything with postMessage/onmessage semantics.
 * Requests are serialized; the engine only handles one search at a time.
 */
export class UciEvaluator implements Evaluator {
  private queue: Promise<unknown> = Promise.resolve();
  private listener: ((line: string) => void) | null = null;

  constructor(private send: (cmd: string) => void) {
    send("uci");
    send("setoption name Hash value 32");
    send("isready");
  }

  /** Feed every line the engine prints into this. */
  receive(line: string) {
    this.listener?.(line);
  }

  newGame() {
    this.queue = this.queue.then(() => this.send("ucinewgame"));
  }

  evaluate(fen: string, depth: number): Promise<EngineResult> {
    const run = () =>
      new Promise<EngineResult>((resolve) => {
        let score = 0;
        this.listener = (line) => {
          if (line.startsWith("info") && line.includes(" score ") && !line.includes("bound")) {
            const s = parseScore(line);
            if (s !== null) score = s;
          } else if (line.startsWith("bestmove")) {
            this.listener = null;
            const bm = line.split(" ")[1];
            resolve({ score, bestmove: bm && bm !== "(none)" ? bm : "" });
          }
        };
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
      });
    const p = this.queue.then(run);
    this.queue = p.catch(() => undefined);
    return p;
  }
}

let browserEngine: UciEvaluator | null = null;

/** The Stockfish WASM engine, running in a Web Worker. Browser only. */
export function getBrowserEngine(): UciEvaluator {
  if (!browserEngine) {
    const worker = new Worker("/engine/stockfish-19-lite-single.js");
    browserEngine = new UciEvaluator((cmd) => worker.postMessage(cmd));
    const engine = browserEngine;
    worker.onmessage = (e: MessageEvent) => engine.receive(String(e.data));
  }
  return browserEngine;
}
