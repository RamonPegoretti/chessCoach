"use client";

import { useState } from "react";
import { useStore } from "./store";
import { Button, Card } from "./ui";

export function ImportPanel() {
  const { accounts, importAccount, importState, cancelImport, importPgn, removeAccount, games } = useStore();
  const [source, setSource] = useState<"lichess" | "chesscom">("lichess");
  const [username, setUsername] = useState("");
  const [pgn, setPgn] = useState("");
  const [you, setYou] = useState("");
  const [pgnMsg, setPgnMsg] = useState("");

  const countFor = (id: string) => games.filter((g) => g.account === id).length;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="text-lg font-semibold">Import an account</h2>
        <p className="mt-1 text-sm text-slate-400">
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
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  source === s ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-slate-700 text-slate-300"
                }`}
              >
                {s === "lichess" ? "Lichess" : "Chess.com"}
              </button>
            ))}
          </div>
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
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
          {importState.message && <p className="text-sm text-slate-300">{importState.message}</p>}
          {importState.error && <p className="text-sm text-red-400">{importState.error}</p>}
        </form>

        {accounts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-300">Your accounts</h3>
            <ul className="mt-2 divide-y divide-slate-800">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">{a.username}</span>{" "}
                    <span className="text-slate-400">
                      on {a.source === "lichess" ? "Lichess" : "Chess.com"} · {countFor(a.id)} games
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button
                      variant="ghost"
                      disabled={importState.running}
                      onClick={() => importAccount(a.source as "lichess" | "chesscom", a.username)}
                    >
                      Sync
                    </Button>
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
        <h2 className="text-lg font-semibold">Paste PGN</h2>
        <p className="mt-1 text-sm text-slate-400">One game or many. Your name picks which side you played.</p>
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
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            placeholder="Your name in these games (optional)"
            value={you}
            onChange={(e) => setYou(e.target.value)}
          />
          <textarea
            className="h-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
            placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 ...'}
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
          />
          <Button type="submit" disabled={!pgn.trim()}>
            Add games
          </Button>
          {pgnMsg && <p className="text-sm text-slate-300">{pgnMsg}</p>}
        </form>
      </Card>
    </div>
  );
}
