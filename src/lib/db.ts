import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Source, StoredGame } from "./types";

export interface Account {
  /** `${source}:${username lowercased}` */
  id: string;
  source: Source;
  username: string;
  /** Lichess: newest game time seen (ms). Chess.com: last archive month fully synced, "YYYY/MM". */
  cursor?: number | string;
  lastSync?: number;
}

interface CoachDB extends DBSchema {
  games: { key: string; value: StoredGame; indexes: { account: string } };
  accounts: { key: string; value: Account };
}

let dbPromise: Promise<IDBPDatabase<CoachDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<CoachDB>("chess-coach", 1, {
      upgrade(d) {
        const games = d.createObjectStore("games", { keyPath: "id" });
        games.createIndex("account", "account");
        d.createObjectStore("accounts", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function putGames(games: StoredGame[]) {
  if (!games.length) return;
  const tx = (await db()).transaction("games", "readwrite");
  await Promise.all([...games.map((g) => tx.store.put(g)), tx.done]);
}

export async function allGames(): Promise<StoredGame[]> {
  return (await db()).getAll("games");
}

export async function putGame(game: StoredGame) {
  await (await db()).put("games", game);
}

export async function allAccounts(): Promise<Account[]> {
  return (await db()).getAll("accounts");
}

export async function putAccount(a: Account) {
  await (await db()).put("accounts", a);
}

export async function deleteAccount(a: Account) {
  const d = await db();
  const keys = await d.getAllKeysFromIndex("games", "account", a.id);
  const tx = d.transaction(["games", "accounts"], "readwrite");
  await Promise.all([
    ...keys.map((k) => tx.objectStore("games").delete(k)),
    tx.objectStore("accounts").delete(a.id),
    tx.done,
  ]);
}
