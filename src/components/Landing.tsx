"use client";

import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { useStore } from "./store";
import { BOARD, Button, Eyebrow } from "./ui";
import type { Go } from "./App";

// A position from Morphy's Opera Game, just before the final combination.
const HERO_FEN = "4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16";

export function Landing({ go }: { go: Go }) {
  const { importAccount, importState, cancelImport, loadDemo } = useStore();
  const [source, setSource] = useState<"lichess" | "chesscom">("lichess");
  const [username, setUsername] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[38rem] w-[38rem] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, #b9862d 0%, transparent 65%)" }}
      />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="font-display flex items-center gap-2 text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brass text-lg text-ink">♞</span>
          Chess Coach
        </div>
        <span className="hidden text-sm text-muted sm:inline">Free · no account · runs in your browser</span>
      </header>

      <section className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 pb-16 pt-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="animate-rise">
          <Eyebrow>Your games, reviewed by Stockfish</Eyebrow>
          <h1 className="font-display mt-5 text-5xl leading-[1.02] md:text-7xl">
            Every game you&apos;ve played <em className="text-brass">tells a story.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Find out which chess legend you play like, get one score for your play, relive your costliest mistake, and
            follow a course built from your own blunders.
          </p>

          <form
            className="mt-10 max-w-lg rounded-3xl border border-line bg-panel/80 p-2 backdrop-blur"
            onSubmit={(e) => {
              e.preventDefault();
              importAccount(source, username).then(() => go("home"));
            }}
          >
            <div className="flex gap-1 p-1">
              {(["lichess", "chesscom"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm transition ${
                    source === s ? "bg-raised text-cream" : "text-muted hover:text-cream"
                  }`}
                >
                  {s === "lichess" ? "Lichess" : "Chess.com"}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 p-1 sm:flex-row">
              <input
                className="min-w-0 flex-1 rounded-full border border-line bg-ink px-5 py-3 text-base text-cream outline-none placeholder:text-faint focus:border-brass"
                placeholder={`Your ${source === "lichess" ? "Lichess" : "Chess.com"} username`}
                value={username}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Button type="submit" size="lg" disabled={importState.running || !username.trim()}>
                {importState.running ? "Importing…" : "Tell my story"}
              </Button>
            </div>
          </form>
          {importState.running && (
            <p className="mt-4 flex items-center gap-3 text-sm text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />
              {importState.message}
              <button className="text-cream underline-offset-4 hover:underline" onClick={cancelImport}>
                Stop
              </button>
            </p>
          )}
          {importState.error && <p className="mt-4 text-sm text-coral">{importState.error}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
            <button
              className="text-cream underline decoration-line underline-offset-4 hover:decoration-brass"
              disabled={loadingDemo}
              onClick={async () => {
                setLoadingDemo(true);
                await loadDemo();
                go("story");
              }}
            >
              {loadingDemo ? "Loading demo…" : "See a demo story"}
            </button>
            <button
              className="underline decoration-line underline-offset-4 hover:text-cream"
              onClick={() => go("accounts")}
            >
              Paste a PGN instead
            </button>
          </div>
        </div>

        <div className="animate-rise relative mx-auto w-full max-w-md [animation-delay:150ms]">
          <div className="rotate-[-3deg]">
            <Chessboard
              options={{
                position: HERO_FEN,
                allowDragging: false,
                showNotation: false,
                ...BOARD,
                arrows: [{ startSquare: "b3", endSquare: "b8", color: "rgba(224,173,79,0.9)" }],
              }}
            />
          </div>
          <div className="absolute -bottom-6 -left-4 rounded-2xl border border-line bg-panel/95 px-5 py-4 shadow-2xl backdrop-blur sm:-left-10">
            <div className="text-xs uppercase tracking-[0.14em] text-faint">You play like</div>
            <div className="font-display mt-1 text-2xl">Paul Morphy</div>
            <div className="text-xs text-brass">82% style match</div>
          </div>
          <div className="absolute -right-2 -top-6 rounded-2xl border border-line bg-panel/95 px-5 py-4 text-center shadow-2xl backdrop-blur sm:-right-8">
            <div className="text-xs uppercase tracking-[0.14em] text-faint">Score</div>
            <div className="font-display tabular text-4xl text-brass">74</div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-6xl gap-px overflow-hidden rounded-3xl border border-line bg-line md:mb-16 md:grid-cols-4">
        {[
          [
            "01",
            "Your legend",
            "Nine world-class styles, from Tal's chaos to Karpov's squeeze. See whose games look like yours.",
          ],
          ["02", "Your score", "One number from 0 to 100 built from accuracy, blunders, conversion and consistency."],
          [
            "03",
            "Costliest mistake",
            "The single move that cost you the most, replayed on the board with the move you missed.",
          ],
          [
            "04",
            "Your course",
            "Lessons and puzzles made from your own games, ordered by what loses you the most points.",
          ],
        ].map(([n, t, d]) => (
          <div key={n} className="bg-ink p-6">
            <div className="tabular text-xs text-brass">{n}</div>
            <div className="font-display mt-3 text-xl">{t}</div>
            <p className="mt-2 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
