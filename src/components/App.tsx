"use client";

import { useCallback, useEffect, useState } from "react";
import { StoreProvider, useStore } from "./store";
import { ImportPanel } from "./ImportPanel";
import { GamesPanel } from "./GamesPanel";
import { HomePanel } from "./HomePanel";
import { TrainPanel } from "./TrainPanel";
import { CoursePanel } from "./CoursePanel";
import { StoryView } from "./StoryView";
import { Landing } from "./Landing";
import { StatsPanel } from "./StatsPanel";

const NAV = [
  { id: "home", label: "Home", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { id: "story", label: "Story", icon: "M12 3l2.6 5.6L21 9.3l-4.6 4.3 1.2 6.4L12 17l-5.6 3 1.2-6.4L3 9.3l6.4-.7z" },
  {
    id: "course",
    label: "Course",
    icon: "M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z M12 6v13.5",
  },
  { id: "puzzles", label: "Puzzles", icon: "M9 4h6v3a2 2 0 1 0 0 4v0h3v6h-3a2 2 0 1 1-4 0H6v-6h3a2 2 0 1 0 0-4z" },
  { id: "games", label: "Games", icon: "M4 4h16v16H4z M4 12h16 M12 4v16" },
  { id: "stats", label: "Stats", icon: "M5 20V11 M12 20V5 M19 20v-6 M3 20h18" },
  {
    id: "accounts",
    label: "Accounts",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5",
  },
] as const;
export type Route = (typeof NAV)[number]["id"];

/** Hash routing: #/games/<id>, #/course/<module>. Keeps the back button and links working. */
function useRoute() {
  const parse = () => {
    const parts = (typeof window === "undefined" ? "" : window.location.hash).replace(/^#\/?/, "").split("/");
    return {
      page: (parts[0] || "home") as Route,
      param: parts.slice(1).join("/") ? decodeURIComponent(parts.slice(1).join("/")) : null,
    };
  };
  const [route, setRoute] = useState<{ page: Route; param: string | null }>({ page: "home", param: null });
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((page: Route, param?: string | null) => {
    window.location.hash = `/${page}${param ? `/${encodeURIComponent(param)}` : ""}`;
  }, []);
  return { ...route, go };
}
export type Go = ReturnType<typeof useRoute>["go"];

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { loaded, games, importState } = useStore();
  const { page, param, go } = useRoute();

  if (!loaded) {
    return (
      <div className="grid flex-1 place-items-center">
        <div className="font-display animate-pulse text-4xl text-faint">♞</div>
      </div>
    );
  }
  if (!games.length && page !== "accounts") return <Landing go={go} />;
  if (importState.running && games.length < 1) return <Landing go={go} />;

  return (
    <div className="flex flex-1">
      <Sidebar page={page} go={go} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-6 md:px-10 md:pb-16 md:pt-12">
          <div key={page} className="animate-fade">
            {page === "story" ? (
              <StoryView go={go} />
            ) : page === "course" ? (
              <CoursePanel moduleId={param} go={go} />
            ) : page === "puzzles" ? (
              <TrainPanel />
            ) : page === "games" ? (
              <GamesPanel openId={param} go={go} />
            ) : page === "stats" ? (
              <StatsPanel go={go} />
            ) : page === "accounts" ? (
              <ImportPanel go={go} />
            ) : (
              <HomePanel go={go} />
            )}
          </div>
        </main>
      </div>
      <BottomNav page={page} go={go} />
    </div>
  );
}

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d={d} />
    </svg>
  );
}

function Logo() {
  return (
    <a href="#/home" className="font-display flex items-center gap-2 text-xl text-cream">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brass text-lg text-ink">♞</span>
      Chess Coach
    </a>
  );
}

function Sidebar({ page, go }: { page: Route; go: Go }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
      <div className="px-2">
        <Logo />
      </div>
      <nav className="mt-10 flex flex-col gap-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              page === n.id ? "bg-raised text-cream" : "text-muted hover:bg-panel hover:text-cream"
            }`}
          >
            <Icon d={n.icon} className={page === n.id ? "text-brass" : ""} />
            {n.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto">
        <QueueStatus />
      </div>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/90 px-5 py-3 backdrop-blur md:hidden">
      <Logo />
      <QueueStatus compact />
    </header>
  );
}

function BottomNav({ page, go }: { page: Route; go: Go }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-line bg-ink/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {NAV.map((n) => (
        <button
          key={n.id}
          onClick={() => go(n.id)}
          className={`flex flex-col items-center gap-1 py-2.5 text-[10px] ${page === n.id ? "text-brass" : "text-faint"}`}
        >
          <Icon d={n.icon} />
          {n.label}
        </button>
      ))}
    </nav>
  );
}

/** Background engine review progress. */
function QueueStatus({ compact }: { compact?: boolean }) {
  const { queue, setPaused, games } = useStore();
  if (!games.length) return null;
  const reviewed = games.length - queue.remaining;
  const done = queue.remaining === 0;
  const pct = (reviewed / games.length) * 100;
  if (compact) {
    return done ? null : (
      <button onClick={() => setPaused(!queue.paused)} className="flex items-center gap-2 text-xs text-muted">
        <span className={`h-2 w-2 rounded-full ${queue.paused ? "bg-faint" : "animate-pulse bg-brass"}`} />
        {reviewed}/{games.length}
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-panel p-4 text-xs">
      <div className="flex items-center justify-between text-muted">
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${done ? "bg-sage" : queue.paused ? "bg-faint" : "animate-pulse bg-brass"}`}
          />
          {done ? "All games reviewed" : queue.paused ? "Review paused" : "Reviewing games"}
        </span>
        {!done && (
          <button className="text-cream hover:text-brass" onClick={() => setPaused(!queue.paused)}>
            {queue.paused ? "Resume" : "Pause"}
          </button>
        )}
      </div>
      <div className="mt-3 h-1 rounded-full bg-line">
        <div className="h-1 rounded-full bg-brass transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="tabular mt-2 text-faint">
        {reviewed} of {games.length} games
      </div>
    </div>
  );
}
