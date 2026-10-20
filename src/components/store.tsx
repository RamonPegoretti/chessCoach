"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as db from "@/lib/db";
import type { Account } from "@/lib/db";
import { accountKey, importChesscom, importLichess, parsePgnText } from "@/lib/importers";
import { analyzeGame } from "@/lib/analysis";
import type { Source, StoredGame } from "@/lib/types";

export interface ImportState {
  running: boolean;
  message: string;
  error?: string;
}

export interface QueueState {
  paused: boolean;
  current?: string;
  progress?: number;
  remaining: number;
}

interface Store {
  loaded: boolean;
  /** How many games were saved when the app opened. */
  initialCount: number;
  games: StoredGame[];
  accounts: Account[];
  importState: ImportState;
  queue: QueueState;
  depth: number;
  setDepth: (d: number) => void;
  importAccount: (source: Exclude<Source, "pgn">, username: string) => Promise<void>;
  cancelImport: () => void;
  importPgn: (text: string, you: string) => Promise<number>;
  removeAccount: (a: Account) => Promise<void>;
  setPaused: (p: boolean) => void;
  prioritize: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [initialCount, setInitialCount] = useState(0);
  const [games, setGames] = useState<StoredGame[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [importState, setImportState] = useState<ImportState>({ running: false, message: "" });
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const [depth, setDepth] = useState(10);
  const abortRef = useRef<AbortController | null>(null);
  const priorityRef = useRef<string | null>(null);
  const [priorityTick, setPriorityTick] = useState(0);

  useEffect(() => {
    Promise.all([db.allGames(), db.allAccounts()]).then(([g, a]) => {
      setGames(g);
      setInitialCount(g.length);
      setAccounts(a);
      setLoaded(true);
    });
  }, []);

  const mergeGames = useCallback((incoming: StoredGame[]) => {
    if (!incoming.length) return;
    setGames((prev) => {
      const map = new Map(prev.map((g) => [g.id, g]));
      for (const g of incoming) {
        const old = map.get(g.id);
        map.set(g.id, old?.analysis ? { ...g, analysis: old.analysis } : g);
      }
      return [...map.values()];
    });
  }, []);

  const importAccount = useCallback(
    async (source: Exclude<Source, "pgn">, username: string) => {
      const name = username.trim();
      if (!name) return;
      const id = accountKey(source, name);
      const existing = (await db.allAccounts()).find((a) => a.id === id);
      const account: Account = existing ?? { id, source, username: name };
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setImportState({ running: true, message: "Starting import…" });
      const known = new Set(games.map((g) => g.id));
      try {
        const run = source === "lichess" ? importLichess : importChesscom;
        await run(
          account,
          async (batch, p) => {
            // Never overwrite a game we already analysed.
            const fresh = batch.filter((g) => !known.has(g.id));
            await db.putGames(fresh);
            await db.putAccount({ ...account, lastSync: Date.now() });
            mergeGames(fresh);
            setImportState({ running: true, message: p.message });
          },
          ctrl.signal,
        );
        account.lastSync = Date.now();
        await db.putAccount(account);
        setImportState({ running: false, message: "Import finished." });
      } catch (e) {
        const aborted = (e as Error).name === "AbortError";
        await db.putAccount(account);
        setImportState({
          running: false,
          message: aborted ? "Import stopped. Run it again to continue where it left off." : "",
          error: aborted ? undefined : (e as Error).message,
        });
      } finally {
        abortRef.current = null;
        setAccounts(await db.allAccounts());
      }
    },
    [games, mergeGames],
  );

  const importPgn = useCallback(
    async (text: string, you: string) => {
      const parsed = parsePgnText(text, you);
      await db.putGames(parsed);
      mergeGames(parsed);
      return parsed.length;
    },
    [mergeGames],
  );

  const removeAccount = useCallback(async (a: Account) => {
    await db.deleteAccount(a);
    setGames((prev) => prev.filter((g) => g.account !== a.id));
    setAccounts(await db.allAccounts());
  }, []);

  const prioritize = useCallback((id: string) => {
    priorityRef.current = id;
    setPaused(false);
    setPriorityTick((t) => t + 1);
  }, []);

  // ------------------------------------------------------------ background analysis queue
  const pending = useMemo(
    () => games.filter((g) => !g.analysis).sort((a, b) => b.playedAt - a.playedAt),
    [games],
  );
  const busy = useRef(false);

  useEffect(() => {
    if (!loaded || paused || busy.current || !pending.length) return;
    const pick = pending.find((g) => g.id === priorityRef.current) ?? pending[0];
    priorityRef.current = null;
    busy.current = true;
    const signal = { cancelled: false };
    setCurrent(pick.id);
    setProgress(0);
    (async () => {
      try {
        const { getBrowserEngine } = await import("@/lib/engine");
        const analysis = await analyzeGame(pick.pgn, pick.userColor, getBrowserEngine(), {
          depth,
          signal,
          onProgress: (d, t) => setProgress(d / t),
        });
        if (analysis) {
          const updated = { ...pick, analysis };
          await db.putGame(updated);
          setGames((prev) => prev.map((g) => (g.id === pick.id ? updated : g)));
        }
      } catch (e) {
        console.error("analysis failed", pick.id, e);
        // Mark it so the queue moves on instead of retrying a broken game forever.
        const broken = {
          ...pick,
          analysis: { depth, evals: [], best: [], moves: [], accuracy: 0, peakWin: 0 },
        };
        await db.putGame(broken);
        setGames((prev) => prev.map((g) => (g.id === pick.id ? broken : g)));
      } finally {
        busy.current = false;
        setCurrent(undefined);
        setProgress(undefined);
      }
    })();
  }, [loaded, paused, pending, depth, priorityTick]);

  const value: Store = {
    loaded,
    initialCount,
    games,
    accounts,
    importState,
    queue: { paused, current, progress, remaining: pending.length },
    depth,
    setDepth,
    importAccount,
    cancelImport: () => abortRef.current?.abort(),
    importPgn,
    removeAccount,
    setPaused,
    prioritize,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
