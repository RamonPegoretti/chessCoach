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
      <CoursePath course={course} stats={stats} current={current} go={go} />
      <p className="mt-6 text-xs text-faint">
        The course updates as more games are reviewed. Chapters can change when your habits do.
      </p>
    </div>
  );
}

const ROW = 150;
// Horizontal position of each node across the path column, as a fraction of its width: a gentle zig-zag.
const SWING = [0.5, 0.76, 0.88, 0.76, 0.5, 0.24, 0.12, 0.24];

/** A winding path of chapters, Duolingo style: done (green), current (gold, pulsing), upcoming (outlined). */
function CoursePath({
  course,
  stats,
  current,
  go,
}: {
  course: Module[];
  stats: ReturnType<typeof moduleProgress>[];
  current: number;
  go: Go;
}) {
  const n = course.length;
  const height = (n + 1) * ROW;
  const pts = Array.from({ length: n + 1 }, (_, i) => ({ x: SWING[i % SWING.length] * 100, y: i * ROW + ROW / 2 }));
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `C${a.x},${a.y + ROW / 2} ${b.x},${b.y - ROW / 2} ${b.x},${b.y}`;
  const full =
    `M${pts[0].x},${pts[0].y} ` +
    pts
      .slice(1)
      .map((p, i) => seg(pts[i], p))
      .join(" ");
  // Green up to the current chapter (or to the end if everything is done).
  const reached = current === -1 ? n : current;
  const done =
    reached > 0
      ? `M${pts[0].x},${pts[0].y} ` +
        pts
          .slice(1, reached + 1)
          .map((p, i) => seg(pts[i], p))
          .join(" ")
      : "";
  const allDone = current === -1;

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-y-0 left-0 w-36 sm:w-72">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={full}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="10"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={full}
            fill="none"
            stroke="var(--color-faint)"
            strokeWidth="2"
            strokeDasharray="2 10"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {done && (
            <path
              d={done}
              fill="none"
              stroke="var(--color-sage)"
              strokeWidth="10"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>

      {course.map((m, i) => {
        const s = stats[i];
        const isCurrent = i === current;
        const p = pts[i];
        return (
          <div key={m.id} className="absolute inset-x-0 flex items-center" style={{ top: p.y - 40, height: 80 }}>
            <div className="relative h-full w-36 shrink-0 sm:w-72">
              <button
                onClick={() => go("course", m.id)}
                aria-label={`Chapter ${i + 1}: ${m.title}`}
                className="group absolute top-0 -translate-x-1/2"
                style={{ left: `${p.x}%` }}
              >
                {isCurrent && <span className="animate-halo absolute inset-0 rounded-full bg-brass" />}
                <span
                  className={`font-display relative grid h-20 w-20 place-items-center rounded-full text-2xl transition group-hover:scale-105 group-active:scale-95 ${
                    s.done
                      ? "bg-sage text-ink shadow-[0_6px_0_#5f8a59]"
                      : isCurrent
                        ? "bg-brass text-ink shadow-[0_6px_0_#9a6f22]"
                        : "border-2 border-line bg-panel text-muted shadow-[0_6px_0_#0c0a09]"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                  {!s.done && s.pct > 0 && (
                    <svg className="absolute -inset-1.5 -rotate-90" viewBox="0 0 92 92" aria-hidden>
                      <circle
                        cx="46"
                        cy="46"
                        r="43"
                        fill="none"
                        stroke="var(--color-sage)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={270}
                        strokeDashoffset={270 * (1 - s.pct / 100)}
                      />
                    </svg>
                  )}
                </span>
              </button>
            </div>
            <button onClick={() => go("course", m.id)} className="min-w-0 flex-1 pl-2 text-left sm:pl-6">
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`font-display text-lg sm:text-xl ${s.done || isCurrent ? "text-cream" : "text-muted"}`}
                >
                  {m.title}
                </span>
                {isCurrent && (
                  <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brass">
                    {s.pct ? "Continue" : "Start here"}
                  </span>
                )}
              </span>
              <span className="mt-1 line-clamp-2 hidden text-sm text-muted sm:block">{m.evidence}</span>
              <span className="tabular mt-1 block text-xs text-faint">
                {s.lesson ? "Lesson ✓" : "Lesson"} · {Math.min(s.solved, m.goal)}/{m.goal} puzzles
              </span>
            </button>
          </div>
        );
      })}

      {/* Finish line */}
      <div className="absolute inset-x-0 flex items-center" style={{ top: pts[n].y - 40, height: 80 }}>
        <div className="relative h-full w-36 shrink-0 sm:w-72">
          <span
            className={`absolute top-0 grid h-20 w-20 -translate-x-1/2 place-items-center rounded-full text-3xl ${
              allDone ? "bg-brass text-ink" : "border-2 border-dashed border-line text-faint"
            }`}
            style={{ left: `${pts[n].x}%` }}
          >
            ♔
          </span>
        </div>
        <div className="pl-2 sm:pl-6">
          <div className={`font-display text-lg sm:text-xl ${allDone ? "text-brass" : "text-faint"}`}>
            {allDone ? "Course complete" : "Finish line"}
          </div>
          <div className="text-sm text-faint">
            {allDone ? "New chapters appear as your games change." : `${n - Math.max(0, reached)} chapters to go`}
          </div>
        </div>
      </div>
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
