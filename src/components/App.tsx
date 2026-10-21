"use client";

import { useState } from "react";
import { StoreProvider, useStore } from "./store";
import { ImportPanel } from "./ImportPanel";
import { GamesPanel } from "./GamesPanel";
import { CoachPanel } from "./CoachPanel";
import { TrainPanel } from "./TrainPanel";

const TABS = [
  { id: "coach", label: "Coach" },
  { id: "games", label: "Games" },
  { id: "train", label: "Train" },
  { id: "import", label: "Import" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { loaded, initialCount } = useStore();
  const [tab, setTab] = useState<Tab | null>(null);
  const [openGame, setOpenGame] = useState<string | null>(null);
  // Returning users start on their coaching report, new users on Import.
  const active: Tab = tab ?? (initialCount ? "coach" : "import");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <h1 className="text-xl font-bold">
          ♞ Chess <span className="text-emerald-400">Coach</span>
        </h1>
        <nav className="flex gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id !== "games") setOpenGame(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${
                active === t.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <QueueBar />
      <main className="mt-4">
        {!loaded ? (
          <p className="text-slate-400">Loading your games…</p>
        ) : active === "import" ? (
          <ImportPanel />
        ) : active === "games" ? (
          <GamesPanel openId={openGame} onOpen={setOpenGame} />
        ) : active === "train" ? (
          <TrainPanel />
        ) : (
          <CoachPanel />
        )}
      </main>
    </div>
  );
}

function QueueBar() {
  const { queue, setPaused, depth, setDepth, games } = useStore();
  if (!games.length) return null;
  const reviewed = games.length - queue.remaining;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
      <span>
        Engine review: <span className="font-semibold">{reviewed}</span> of {games.length} games
        {Object.keys(queue.active).length > 0 &&
          ` · ${Object.keys(queue.active).length} at a time on ${queue.engines} engine${queue.engines > 1 ? "s" : ""}`}
        {queue.remaining === 0 && " · all done"}
      </span>
      <div className="h-1.5 min-w-24 flex-1 rounded bg-slate-800">
        <div className="h-1.5 rounded bg-emerald-500" style={{ width: `${(reviewed / games.length) * 100}%` }} />
      </div>
      {queue.remaining > 0 && (
        <button className="text-emerald-400" onClick={() => setPaused(!queue.paused)}>
          {queue.paused ? "Resume" : "Pause"}
        </button>
      )}
      <label className="flex items-center gap-1">
        Depth
        <select
          className="rounded bg-slate-800 px-1 py-0.5"
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
          title="Higher is more accurate but slower"
        >
          {[8, 10, 12, 14, 16].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
