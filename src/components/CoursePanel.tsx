"use client";

import { moduleProgress, type Module } from "@/lib/course";
import { useStore } from "./store";
import { PuzzleTrainer } from "./PuzzleTrainer";
import { Button, Card, EmptyState, PageHeader, Ring, moveNumber } from "./ui";
import type { Go } from "./App";

export function CoursePanel({ moduleId, go }: { moduleId: string | null; go: Go }) {
  const { course, progress } = useStore();

  if (!course.length) {
    return (
      <EmptyState title="Your course needs a few reviewed games">
        Once Stockfish has reviewed some of your games, your personal course appears here: one chapter for each habit
        that costs you the most points.
      </EmptyState>
    );
  }

  const open = course.find((m) => m.id === moduleId);
  if (open) {
    const idx = course.indexOf(open);
    return <ModuleView m={open} index={idx} next={course[idx + 1]} go={go} />;
  }

  const stats = course.map((m) => moduleProgress(m, progress));
  const overall = Math.round(stats.reduce((s, x) => s + x.pct, 0) / stats.length);
  const current = course.findIndex((_, i) => !stats[i].done);

  return (
    <div>
      <PageHeader
        eyebrow="Your course"
        title="Built from your own games"
        sub="Each chapter targets one habit that costs you points, ordered by how much it hurts. Read the short lesson, then fix the real positions where it happened."
        action={
          <Ring value={overall} size={96} stroke={7} color="var(--color-sage)">
            <div>
              <div className="font-display tabular text-2xl">{overall}%</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-faint">done</div>
            </div>
          </Ring>
        }
      />
      <ol className="relative flex flex-col gap-3">
        {course.map((m, i) => {
          const s = stats[i];
          const isCurrent = i === current;
          return (
            <li key={m.id}>
              <button
                onClick={() => go("course", m.id)}
                className={`group flex w-full items-center gap-5 rounded-2xl border p-5 text-left transition ${
                  isCurrent ? "border-brass/50 bg-panel" : "border-line hover:border-faint hover:bg-panel"
                }`}
              >
                <span
                  className={`font-display grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg ${
                    s.done ? "bg-sage text-ink" : isCurrent ? "bg-brass text-ink" : "border border-line text-muted"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl text-cream">{m.title}</span>
                    {isCurrent && (
                      <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brass">
                        Up next
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-muted">{m.evidence}</span>
                  <span className="mt-3 flex items-center gap-3 text-xs text-faint">
                    <span className="h-1 w-32 rounded-full bg-line">
                      <span className="block h-1 rounded-full bg-sage" style={{ width: `${s.pct}%` }} />
                    </span>
                    <span className="tabular">
                      {s.lesson ? "Lesson ✓" : "Lesson"} · {Math.min(s.solved, m.goal)}/{m.goal} puzzles
                    </span>
                  </span>
                </span>
                <span className="text-muted transition group-hover:translate-x-1 group-hover:text-cream">→</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-xs text-faint">
        The course updates as more games are reviewed. Chapters can change when your habits do.
      </p>
    </div>
  );
}

/** Where this habit shows up: by game phase, plus the most recent example. */
function InYourGames({ m }: { m: Module }) {
  if (m.puzzles.length < 2) return null;
  const phases = (["opening", "middlegame", "endgame"] as const).map((ph) => ({
    ph,
    n: m.puzzles.filter((p) => p.move.phase === ph).length,
  }));
  const max = Math.max(...phases.map((p) => p.n), 1);
  const latest = m.puzzles[0];
  const opp = latest.game.userColor === "w" ? latest.game.black : latest.game.white;
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="text-xs uppercase tracking-[0.16em] text-faint">In your games</div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {phases.map(({ ph, n }) => (
          <div key={ph}>
            <div className="flex h-12 items-end">
              <div
                className="w-full rounded-t-md bg-brass/70"
                style={{ height: n ? `${Math.max(8, (n / max) * 100)}%` : "2px" }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="capitalize text-muted">{ph}</span>
              <span className="tabular text-cream">{n}</span>
            </div>
          </div>
        ))}
      </div>
      <a
        href={`#/games/${encodeURIComponent(latest.game.id)}`}
        className="mt-4 block text-sm text-muted underline-offset-4 hover:text-cream hover:underline"
      >
        Latest example: {moveNumber(latest.move.ply)} {latest.move.san} against {opp} →
      </a>
    </div>
  );
}

function ModuleView({ m, index, next, go }: { m: Module; index: number; next?: Module; go: Go }) {
  const { progress, markLesson } = useStore();
  const s = moduleProgress(m, progress);

  return (
    <div>
      <button className="mb-6 text-sm text-muted hover:text-cream" onClick={() => go("course")}>
        ← All chapters
      </button>
      <PageHeader
        eyebrow={`Chapter ${index + 1}`}
        title={m.title}
        sub={m.evidence}
        action={
          <Ring value={s.pct} size={88} stroke={7} color="var(--color-sage)">
            <span className="tabular text-lg">{s.pct}%</span>
          </Ring>
        }
      />

      <section className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-brass">Step 1 · The idea</div>
          <div className="mt-4 flex flex-col gap-3 text-[15px] leading-relaxed text-cream/90">
            {m.lesson.concept.map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
          <InYourGames m={m} />
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-brass">Your checklist</div>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            {m.lesson.checklist.map((c) => (
              <li key={c} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brass" />
                <span className="text-cream/85">{c}</span>
              </li>
            ))}
          </ul>
          {!s.lesson ? (
            <Button className="mt-6" onClick={() => markLesson(m.id)}>
              Got it, on to the puzzles
            </Button>
          ) : (
            <p className="mt-6 text-sm text-sage">✓ Lesson done</p>
          )}
        </Card>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-brass">Step 2 · Practise on your games</div>
            <h2 className="font-display mt-2 text-3xl">Solve {m.goal} on the first try</h2>
          </div>
          <span className="tabular text-sm text-muted">
            {Math.min(s.solved, m.goal)} / {m.goal} solved
          </span>
        </div>
        {m.puzzles.length ? (
          <PuzzleTrainer key={m.id} puzzles={m.puzzles} />
        ) : (
          <EmptyState title="No positions yet">
            None of your reviewed games has a clear puzzle for this chapter yet. Keep the lesson in mind in your next
            games.
          </EmptyState>
        )}
      </section>

      {s.done && (
        <Card className="mt-10 flex flex-wrap items-center justify-between gap-4 border-sage/40">
          <div>
            <div className="font-display text-2xl text-sage">Chapter complete</div>
            <p className="mt-1 text-sm text-muted">
              Now take it into your games. The course will notice if the habit comes back.
            </p>
          </div>
          {next ? (
            <Button onClick={() => go("course", next.id)}>Next: {next.title} →</Button>
          ) : (
            <Button variant="ghost" onClick={() => go("course")}>
              Back to the course
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
