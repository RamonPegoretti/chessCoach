"use client";

import { useMemo } from "react";
import { moduleProgress } from "@/lib/course";
import { MOTIF_LABEL } from "@/lib/labels";
import { useStore } from "./store";
import { usePlayerName } from "./StoryView";
import { MomentBoard } from "./MomentBoard";
import { Button, Card, Eyebrow, Ring, Stat, moveNumber } from "./ui";
import type { Go } from "./App";

export function HomePanel({ go }: { go: Go }) {
  const { profile: p, story, course, progress, games } = useStore();
  const name = usePlayerName();

  const today = useMemo(() => {
    const open = course.find((m) => !moduleProgress(m, progress).done) ?? course[0];
    if (!open) return null;
    return { module: open, prog: moduleProgress(open, progress) };
  }, [course, progress]);

  const recentLoss = useMemo(
    () =>
      games
        .filter((g) => g.result === "loss" && g.analysis?.moves.some((m) => m.cls === "blunder"))
        .sort((a, b) => b.playedAt - a.playedAt)[0],
    [games],
  );

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2">
        <Eyebrow>{greet}</Eyebrow>
        <h1 className="font-display mt-2 text-4xl md:text-5xl">{name === "You" ? "Welcome back." : `Hi, ${name}.`}</h1>
        <p className="mt-3 text-muted">
          {p.total.games.toLocaleString()} games · {p.analysed.toLocaleString()} reviewed by Stockfish
        </p>
      </div>

      {/* Hero row: score, legend, story CTA */}
      {story ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card className="flex items-center gap-6">
            <Ring value={story.score} size={132} stroke={9}>
              <div>
                <div className="font-display tabular text-5xl">{story.score}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-faint">score</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="font-display text-2xl">{story.tier.name} tier</div>
              {story.tier.next && (
                <p className="mt-1 text-sm text-muted">
                  {story.tier.next.at - story.score} points to {story.tier.next.name}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-1.5">
                {story.scoreParts.map((s) => (
                  <div key={s.label} className="flex items-center gap-3 text-xs">
                    <span className="w-28 shrink-0 text-muted">{s.label}</span>
                    <span className="h-1 flex-1 rounded-full bg-line">
                      <span className="block h-1 rounded-full bg-cream/70" style={{ width: `${s.value}%` }} />
                    </span>
                    <span className="tabular w-6 text-right text-cream">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <button
            onClick={() => go("story")}
            className="group relative overflow-hidden rounded-2xl border border-line p-6 text-left transition hover:border-brass/50"
            style={{ background: "radial-gradient(120% 120% at 100% 0%, #4a3412 0%, #1c1815 55%)" }}
          >
            <div className="text-xs uppercase tracking-[0.16em] text-faint">You play like</div>
            <div className="font-display mt-2 text-4xl text-brass md:text-5xl">{story.legend.name}</div>
            <p className="mt-2 max-w-md text-sm text-cream/80">{story.legend.blurb}</p>
            <div className="mt-6 flex items-center gap-2 text-sm text-cream">
              Watch your chess story <span className="transition group-hover:translate-x-1">→</span>
            </div>
            <div className="font-display pointer-events-none absolute -bottom-10 -right-4 text-[11rem] leading-none text-cream/[0.04]">
              ♛
            </div>
          </button>
        </div>
      ) : (
        <Card>
          <div className="font-display text-2xl">Your story is on its way</div>
          <p className="mt-2 text-sm text-muted">
            As soon as Stockfish has reviewed a few games, you&apos;ll see your score, your chess legend and your
            costliest mistake here.
          </p>
        </Card>
      )}

      {/* Today's training */}
      {today && (
        <Card className="grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
          <Ring value={today.prog.pct} size={72} stroke={6} color="var(--color-sage)">
            <span className="tabular text-sm">{today.prog.pct}%</span>
          </Ring>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-faint">Today&apos;s training</div>
            <div className="font-display mt-1 text-2xl">{today.module.title}</div>
            <p className="mt-1 text-sm text-muted">
              {today.prog.lesson ? "Lesson read · " : "Short lesson · "}
              {today.prog.solved} of {today.module.goal} puzzles solved
            </p>
          </div>
          <Button onClick={() => go("course", today.module.id)}>{today.prog.pct ? "Continue" : "Start"}</Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Record"
          value={`${p.total.score}%`}
          hint={`${p.total.wins}W · ${p.total.draws}D · ${p.total.losses}L`}
        />
        <Stat label="Accuracy" value={p.accuracy !== undefined ? `${p.accuracy}` : "–"} hint="average per game" />
        <Stat label="Blunders" value={p.blundersPerGame ?? "–"} hint="per game" />
        <Stat
          label="Conversion"
          value={
            p.thrownWins.of ? `${Math.round(((p.thrownWins.of - p.thrownWins.count) / p.thrownWins.of) * 100)}%` : "–"
          }
          hint="winning positions won"
        />
      </div>

      {story?.costliest && (
        <Card className="grid items-center gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
          <MomentBoard id="home-costliest" game={story.costliest.game} move={story.costliest.move} />
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-coral">Costliest mistake</div>
            <div className="font-display mt-2 text-3xl">
              {moveNumber(story.costliest.move.ply)} {story.costliest.move.san}??
            </div>
            <p className="mt-2 text-sm text-muted">
              {story.costliest.move.explanation} The best move was{" "}
              <span className="font-semibold text-sage">{story.costliest.move.bestSan}</span>.
            </p>
            <Button variant="ghost" className="mt-4" onClick={() => go("games", story.costliest!.game.id)}>
              Replay the game
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="font-display text-xl">Accuracy by phase</h3>
          {Object.keys(p.accuracyByPhase).length === 0 ? (
            <p className="mt-3 text-sm text-muted">Waiting for reviewed games.</p>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              {(["opening", "middlegame", "endgame"] as const).map((ph) =>
                p.accuracyByPhase[ph] === undefined ? null : (
                  <Bar
                    key={ph}
                    label={ph}
                    value={p.accuracyByPhase[ph]!}
                    note={`${p.errorsByPhase[ph]} errors / game`}
                  />
                ),
              )}
            </div>
          )}
          <h3 className="font-display mt-8 text-xl">Why you lose material</h3>
          {p.motifs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Waiting for reviewed games.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-line text-sm">
              {p.motifs.slice(0, 6).map((m) => (
                <li key={m.motif} className="flex justify-between py-2">
                  <span>{MOTIF_LABEL[m.motif].label}</span>
                  <span className="tabular text-muted">
                    {m.count} <span className="text-faint">· {m.perGame}/game</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="font-display text-xl">Rating</h3>
          <RatingChart points={p.rating} />
          <h3 className="font-display mt-8 text-xl">Most played openings</h3>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-faint">
              <tr>
                <th className="py-1 font-normal">Opening</th>
                <th className="text-right font-normal">Games</th>
                <th className="text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody>
              {p.openings.slice(0, 7).map((o) => (
                <tr key={o.color + o.name} className="border-t border-line">
                  <td className="py-2 pr-2">
                    {o.name} <span className="text-xs text-faint">as {o.color === "w" ? "White" : "Black"}</span>
                  </td>
                  <td className="tabular text-right text-muted">{o.games}</td>
                  <td
                    className={`tabular text-right ${o.score >= p.total.score + 8 ? "text-sage" : o.score <= p.total.score - 8 ? "text-coral" : ""}`}
                  >
                    {o.score}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {recentLoss && (
        <button
          onClick={() => go("games", recentLoss.id)}
          className="flex items-center justify-between rounded-2xl border border-line px-5 py-4 text-left text-sm text-muted transition hover:border-faint hover:text-cream"
        >
          <span>
            Review your latest loss against{" "}
            <span className="text-cream">{recentLoss.userColor === "w" ? recentLoss.black : recentLoss.white}</span>
          </span>
          <span>→</span>
        </button>
      )}
    </div>
  );
}

function Bar({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="text-sm">
      <div className="flex justify-between">
        <span className="capitalize">{label}</span>
        <span className="tabular text-muted">
          <span className="text-cream">{value}</span> · {note}
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-line">
        <div className="h-1.5 rounded-full bg-brass" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RatingChart({ points }: { points: { t: number; r: number; speed: string }[] }) {
  const counts = new Map<string, number>();
  for (const p of points) counts.set(p.speed, (counts.get(p.speed) ?? 0) + 1);
  const speed = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pts = points.filter((p) => p.speed === speed);
  if (pts.length < 2) return <p className="mt-3 text-sm text-muted">Not enough rated games.</p>;
  const W = 400;
  const H = 120;
  const minR = Math.min(...pts.map((p) => p.r));
  const maxR = Math.max(...pts.map((p) => p.r));
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const y = (r: number) => H - ((r - minR) / Math.max(1, maxR - minR)) * (H - 12) - 6;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const now = pts[pts.length - 1].r;
  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-2">
        <span className="font-display tabular text-3xl">{now}</span>
        <span className="text-xs capitalize text-muted">{speed}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-28 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="rg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e0ad4f" stopOpacity="0.25" />
            <stop offset="1" stopColor="#e0ad4f" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rg)" />
        <path d={line} fill="none" stroke="#e0ad4f" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="tabular flex justify-between text-xs text-faint">
        <span>{new Date(t0).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
        <span>
          low {minR} · high {maxR}
        </span>
      </div>
    </div>
  );
}
