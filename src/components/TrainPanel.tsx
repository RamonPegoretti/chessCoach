"use client";

import { useMemo, useState } from "react";
import { allPuzzles } from "@/lib/course";
import { MOTIF_LABEL } from "@/lib/labels";
import type { Motif, Phase } from "@/lib/types";
import { useStore } from "./store";
import { PuzzleTrainer } from "./PuzzleTrainer";
import { EmptyState, PageHeader } from "./ui";

/** Every puzzle from your own games, with filters. */
export function TrainPanel() {
  const { games, progress } = useStore();
  const puzzles = useMemo(() => allPuzzles(games), [games]);
  const [motif, setMotif] = useState<Motif | "all">("all");
  const [phase, setPhase] = useState<Phase | "all">("all");
  const [hideSolved, setHideSolved] = useState(false);

  const motifs = useMemo(() => {
    const counts = new Map<Motif, number>();
    for (const p of puzzles) if (p.move.motif) counts.set(p.move.motif, (counts.get(p.move.motif) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [puzzles]);

  const filtered = useMemo(
    () =>
      puzzles.filter(
        (p) =>
          (motif === "all" || p.move.motif === motif) &&
          (phase === "all" || p.move.phase === phase) &&
          (!hideSolved || progress.puzzles[p.id] !== "first"),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puzzles, motif, phase, hideSolved],
  );
  const solved = puzzles.filter((p) => progress.puzzles[p.id] === "first").length;

  if (!puzzles.length) {
    return (
      <EmptyState title="No puzzles yet">
        Once some of your games are reviewed, every position where you went wrong becomes a puzzle here.
      </EmptyState>
    );
  }

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition ${active ? "border-brass bg-brass/10 text-brass" : "border-line text-muted hover:text-cream"}`;

  return (
    <div>
      <PageHeader
        eyebrow="Puzzles"
        title="Fix your own mistakes"
        sub={
          <>
            {puzzles.length} positions from your games where a better move was there.{" "}
            <span className="tabular text-cream">{solved}</span> solved on the first try.
          </>
        }
      />
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <button className={chip(motif === "all")} onClick={() => setMotif("all")}>
            All themes
          </button>
          {motifs.map(([m, n]) => (
            <button key={m} className={chip(motif === m)} onClick={() => setMotif(m)}>
              {MOTIF_LABEL[m].label} <span className="tabular opacity-60">{n}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "opening", "middlegame", "endgame"] as const).map((ph) => (
            <button key={ph} className={chip(phase === ph)} onClick={() => setPhase(ph)}>
              {ph === "all" ? "Any phase" : ph[0].toUpperCase() + ph.slice(1)}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="accent-[#e0ad4f]"
              checked={hideSolved}
              onChange={(e) => setHideSolved(e.target.checked)}
            />
            Hide solved
          </label>
        </div>
      </div>
      {filtered.length ? (
        <PuzzleTrainer key={`${motif}|${phase}|${hideSolved}`} puzzles={filtered} />
      ) : (
        <EmptyState title="Nothing left here">No puzzles match these filters. Nice work.</EmptyState>
      )}
    </div>
  );
}
