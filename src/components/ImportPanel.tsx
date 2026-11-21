"use client";

import { useState } from "react";
import { useStore } from "./store";
import { Button, Card, PageHeader } from "./ui";
import type { Go } from "./App";

export function ImportPanel({ go }: { go: Go }) {
  const { accounts, importAccount, importState, cancelImport, importPgn, removeAccount, games, depth, setDepth } =
    useStore();
  const [source, setSource] = useState<"lichess" | "chesscom">("lichess");
  const [username, setUsername] = useState("");
  const [pgn, setPgn] = useState("");
  const [you, setYou] = useState("");
  const [pgnMsg, setPgnMsg] = useState("");

  const countFor = (id: string) => games.filter((g) => g.account === id).length;

  return (
    <div>
      <PageHeader
        eyebrow="Accounts"
        title="Your games"
        sub="Everything stays in this browser. Nothing is uploaded, and there's no account to create."
        action={
          !games.length ? (
            <Button variant="ghost" onClick={() => go("home")}>
              ← Back
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-2xl">Import an account</h2>
          <p className="mt-1 text-sm text-muted">
            Downloads every game the account has ever played. Run it again later to fetch only new games.
          </p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              importAccount(source, username);
            }}
          >
            <div className="flex gap-2">
              {(["lichess", "chesscom"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 rounded-full border px-3 py-2 text-sm transition ${
                    source === s ? "border-brass bg-brass/10 text-brass" : "border-line text-muted hover:text-cream"
                  }`}
                >
                  {s === "lichess" ? "Lichess" : "Chess.com"}
                </button>
              ))}
            </div>
            <input
              className="rounded-xl border border-line bg-ink px-4 py-2.5 text-sm outline-none focus:border-brass placeholder:text-faint"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={importState.running || !username.trim()}>
                Import all games
              </Button>
              {importState.running && (
                <Button type="button" variant="ghost" onClick={cancelImport}>
                  Stop
                </Button>
              )}
            </div>
            {importState.message && <p className="text-sm text-muted">{importState.message}</p>}
            {importState.error && <p className="text-sm text-coral">{importState.error}</p>}
          </form>

          {accounts.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs uppercase tracking-[0.16em] text-faint">Connected</h3>
              <ul className="mt-2 divide-y divide-line">
                {accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{a.username}</span>{" "}
                      <span className="text-muted">
                        on {a.source === "lichess" ? "Lichess" : a.source === "chesscom" ? "Chess.com" : "sample data"}{" "}
                        · {countFor(a.id)} games
                      </span>
                    </span>
                    <span className="flex gap-2">
                      {a.source !== "pgn" && (
                        <Button
                          variant="ghost"
                          disabled={importState.running}
                          onClick={() => importAccount(a.source as "lichess" | "chesscom", a.username)}
                        >
                          Sync
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        disabled={importState.running}
                        onClick={() => {
                          if (confirm(`Remove ${a.username} and its games from this browser?`)) removeAccount(a);
                        }}
                      >
                        Remove
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-2xl">Paste PGN</h2>
          <p className="mt-1 text-sm text-muted">One game or many. Your name picks which side you played.</p>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const n = await importPgn(pgn, you);
              setPgnMsg(n ? `Added ${n} game${n === 1 ? "" : "s"}.` : "No valid games found in that text.");
              if (n) setPgn("");
            }}
          >
            <input
              className="rounded-xl border border-line bg-ink px-4 py-2.5 text-sm outline-none focus:border-brass placeholder:text-faint"
              placeholder="Your name in these games (optional)"
              value={you}
              onChange={(e) => setYou(e.target.value)}
            />
            <textarea
              className="h-40 rounded-xl border border-line bg-ink px-4 py-2.5 font-mono text-xs outline-none focus:border-brass placeholder:text-faint"
              placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 ...'}
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
            />
            <Button type="submit" disabled={!pgn.trim()}>
              Add games
            </Button>
            {pgnMsg && <p className="text-sm text-muted">{pgnMsg}</p>}
          </form>
        </Card>
        <Card className="md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl">Engine depth</h2>
              <p className="mt-1 text-sm text-muted">
                Higher is more accurate but slower. 10 is a good balance on most laptops.
              </p>
            </div>
            <div className="flex rounded-full border border-line bg-ink p-1">
              {[8, 10, 12, 14, 16].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`tabular rounded-full px-4 py-1.5 text-sm transition ${depth === d ? "bg-brass text-ink" : "text-muted hover:text-cream"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
