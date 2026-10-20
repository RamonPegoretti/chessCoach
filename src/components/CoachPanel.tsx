"use client";

import { useMemo } from "react";
import { buildProfile } from "@/lib/profile";
import { buildTips } from "@/lib/tips";
import { useStore } from "./store";
import { Card, Stat } from "./ui";

const MOTIF_LABEL: Record<string, string> = {
  "hung-piece": "Hung a piece",
  "lost-material": "Lost material to a cheaper piece",
  "missed-capture": "Missed winning material",
  "missed-fork": "Missed a fork",
  "allowed-fork": "Walked into a fork",
  "allowed-attack": "Missed opponent's threat",
  "missed-mate": "Missed a mate",
  "allowed-mate": "Allowed a mate",
  positional: "Positional / strategic",
};

export function CoachPanel() {
  const { games } = useStore();
  const profile = useMemo(() => buildProfile(games), [games]);
  const tips = useMemo(() => buildTips(profile), [profile]);

  if (!games.length) return <Card>Import some games and your coaching report shows up here.</Card>;

  const p = profile;
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-lg font-semibold">Your top things to work on</h2>
        <p className="mt-1 text-xs text-slate-400">
          Based on {p.total.games} games, {p.analysed} reviewed by the engine so far. Tips get sharper as more games are
          reviewed.
        </p>
        {tips.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">
            Not enough data yet. Once a few games are reviewed, your personal tips will appear here.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            {tips.map((t, i) => (
              <li key={t.id} className="rounded-lg bg-slate-800/50 p-3">
                <div className="font-semibold text-emerald-300">
                  {i + 1}. {t.title}
                </div>
                <div className="mt-1 text-sm text-slate-300">{t.evidence}</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-slate-200">
                  {t.advice.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Games" value={p.total.games} hint={`${p.total.wins}W ${p.total.draws}D ${p.total.losses}L`} />
        <Stat label="Score" value={`${p.total.score}%`} hint={`White ${p.byColor.w.score}% · Black ${p.byColor.b.score}%`} />
        <Stat label="Accuracy" value={p.accuracy !== undefined ? `${p.accuracy}%` : "–"} hint={`${p.analysed} reviewed`} />
        <Stat label="Blunders / game" value={p.blundersPerGame ?? "–"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-slate-300">Accuracy by phase</h3>
          {Object.keys(p.accuracyByPhase).length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Waiting for reviewed games.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {(["opening", "middlegame", "endgame"] as const).map((ph) =>
                p.accuracyByPhase[ph] === undefined ? null : (
                  <Bar key={ph} label={ph} value={p.accuracyByPhase[ph]!} suffix={`% · ${p.errorsByPhase[ph]} errors/game`} />
                ),
              )}
            </div>
          )}
          <h3 className="mt-5 text-sm font-semibold text-slate-300">Why you lose material</h3>
          {p.motifs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Waiting for reviewed games.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {p.motifs.map((m) => (
                <li key={m.motif} className="flex justify-between">
                  <span>{MOTIF_LABEL[m.motif]}</span>
                  <span className="text-slate-400">
                    {m.count} ({m.perGame}/game)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-300">Rating</h3>
          <RatingChart points={p.rating} />
          <h3 className="mt-5 text-sm font-semibold text-slate-300">Most played openings</h3>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-slate-400">
              <tr>
                <th className="font-normal">Opening</th>
                <th className="font-normal">As</th>
                <th className="text-right font-normal">Games</th>
                <th className="text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody>
              {p.openings.slice(0, 10).map((o) => (
                <tr key={o.color + o.name} className="border-t border-slate-800">
                  <td className="py-1 pr-2">{o.name}</td>
                  <td>{o.color === "w" ? "White" : "Black"}</td>
                  <td className="text-right">{o.games}</td>
                  <td
                    className={`text-right ${o.score >= p.total.score + 8 ? "text-emerald-400" : o.score <= p.total.score - 8 ? "text-red-400" : ""}`}
                  >
                    {o.score}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function Bar({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div className="text-sm">
      <div className="flex justify-between capitalize">
        <span>{label}</span>
        <span className="normal-case text-slate-400">
          {value}
          {suffix}
        </span>
      </div>
      <div className="mt-1 h-2 rounded bg-slate-800">
        <div className="h-2 rounded bg-emerald-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RatingChart({ points }: { points: { t: number; r: number; speed: string }[] }) {
  // Show the speed you play the most.
  const counts = new Map<string, number>();
  for (const p of points) counts.set(p.speed, (counts.get(p.speed) ?? 0) + 1);
  const speed = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pts = points.filter((p) => p.speed === speed);
  if (pts.length < 2) return <p className="mt-2 text-sm text-slate-400">Not enough rated games.</p>;
  const W = 400;
  const H = 120;
  const minR = Math.min(...pts.map((p) => p.r));
  const maxR = Math.max(...pts.map((p) => p.r));
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const y = (r: number) => H - ((r - minR) / Math.max(1, maxR - minR)) * (H - 10) - 5;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join(" ");
  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="#34d399" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs text-slate-400">
        <span>
          {speed} · {new Date(t0).getFullYear()}
        </span>
        <span>
          {minR}–{maxR} · now {pts[pts.length - 1].r}
        </span>
      </div>
    </div>
  );
}
