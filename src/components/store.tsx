"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as db from "@/lib/db";
import type { Account } from "@/lib/db";
import { accountKey, importChesscom, importLichess, parsePgnText } from "@/lib/importers";
import { analyzeGame, OpeningCache } from "@/lib/analysis";
import { engineCount, getBrowserEngine } from "@/lib/engine";
import type { GameAnalysis, Source, StoredGame } from "@/lib/types";

export interface ImportState {
  running: boolean;
  message: string;
  error?: string;
}

export interface QueueState {
  paused: boolean;
  /** Games being reviewed right now -> progress 0..1. */
  active: Record<string, number>;
  engines: number;
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
  /** Games being reviewed right now -> progress 0..1. */
  const [active, setActive] = useState<Record<string, number>>({});
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
  // One engine per core; each slot reviews one game at a time, newest games first.
  const pending = useMemo(
    () => games.filter((g) => !g.analysis).sort((a, b) => b.playedAt - a.playedAt),
    [games],
  );
  const [engines] = useState(engineCount);
  const slots = useRef<(string | null)[]>([]);
  const cache = useRef<OpeningCache | null>(null);

  useEffect(() => {
    if (!loaded || paused || !pending.length) return;
    if (!slots.current.length) slots.current = Array(engines).fill(null);
    const running = new Set(slots.current.filter(Boolean));
    cache.current ??= new OpeningCache();

    slots.current.forEach((slotGame, slot) => {
      if (slotGame) return;
      const waiting = pending.filter((g) => !running.has(g.id));
      const pick = waiting.find((g) => g.id === priorityRef.current) ?? waiting[0];
      if (!pick) return;
      if (pick.id === priorityRef.current) priorityRef.current = null;
      running.add(pick.id);
      slots.current[slot] = pick.id;
      setActive((a) => ({ ...a, [pick.id]: 0 }));
      (async () => {
        let analysis: GameAnalysis | null;
        try {
          analysis = await analyzeGame(pick.pgn, pick.userColor, getBrowserEngine(slot), {
            depth,
            cache: cache.current!,
            onProgress: (d, t) => setActive((a) => (pick.id in a ? { ...a, [pick.id]: d / t } : a)),
          });
        } catch (e) {
          console.error("analysis failed", pick.id, e);
          // Mark it so the queue moves on instead of retrying a broken game forever.
          analysis = { depth, evals: [], best: [], moves: [], accuracy: 0, peakWin: 0 };
        }
        if (analysis) {
          const updated = { ...pick, analysis };
          await db.putGame(updated);
          setGames((prev) => prev.map((g) => (g.id === pick.id ? updated : g)));
        }
        slots.current[slot] = null;
        setActive((a) => {
          const rest = { ...a };
          delete rest[pick.id];
          return rest;
        });
      })();
    });
  }, [loaded, paused, pending, depth, priorityTick, engines]);

  const value: Store = {
    loaded,
    initialCount,
    games,
    accounts,
    importState,
    queue: { paused, active, engines, remaining: pending.length },
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
