"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, PageHeader } from "./ui";
import type { Go } from "./App";
import type { Result, Speed, StoredGame } from "@/lib/types";
import {
  ENDING_LABEL,
  SPEED_LABEL,
  buildStats,
  filterGames,
  pct,
  ratingSummaries,
  ratingSeries,
  SITES,
  score,
  type ColorFilter,
  type Period,
  type StatsFilter,
  type WDL,
} from "@/lib/stats";

const SPEED_COLOR: Record<Speed, string> = {
  bullet: "#e8745e",
  blitz: "#e0ad4f",
  rapid: "#8cc084",
  classical: "#7fb4d9",
  daily: "#c49be0",
  unknown: "#a89c8d",
};
const RES_COLOR: Record<Result, string> = { win: "var(--color-sage)", draw: "var(--color-faint)", loss: "var(--color-coral)" };

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtMonth = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
const r0 = (n?: number) => (n === undefined ? "–" : Math.round(n).toLocaleString());
const p0 = (n: number) => `${Math.round(n)}%`;

export function StatsPanel({ go }: { go: Go }) {
  const { games, accounts } = useStore();
  const [f, setF] = useState<StatsFilter>({ speed: "all", color: "all", account: "all", period: "all", ratedOnly: false });
  const set = <K extends keyof StatsFilter>(k: K, v: StatsFilter[K]) => setF((p) => ({ ...p, [k]: v }));

  const allSpeeds = useMemo(() => filterGames(games, f, { ignoreSpeed: true }), [games, f]);
  const filtered = useMemo(
    () => (f.speed === "all" ? allSpeeds : allSpeeds.filter((g) => g.speed === f.speed)),
    [allSpeeds, f.speed],
  );
  const ratings = useMemo(() => ratingSummaries(allSpeeds), [allSpeeds]);
  const bySite = useMemo(
    () =>
      SITES.map(({ id, label }) => {
        const siteGames = allSpeeds.filter((g) => g.source === id);
        const shown = f.speed === "all" ? siteGames : siteGames.filter((g) => g.speed === f.speed);
        return { site: id, label, ratings: ratingSummaries(siteGames), series: ratingSeries(shown), n: siteGames.length };
      }).filter((x) => x.n > 0),
    [allSpeeds, f.speed],
  );
  const s = useMemo(() => buildStats(filtered), [filtered]);

  const accountIds = useMemo(() => [...new Set(games.map((g) => g.account))], [games]);
  const accountName = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    const [src, name] = id.split(":");
    const site = src === "chesscom" ? "Chess.com" : src === "lichess" ? "Lichess" : src === "pgn" ? "PGN" : src;
    return `${a?.username ?? name ?? id} · ${site}`;
  };

  if (!games.length) return <EmptyState title="No games yet">Import an account to see your stats.</EmptyState>;

  const colorWord = f.color === "w" ? "with White" : f.color === "b" ? "with Black" : "";

  return (
    <div>
      <PageHeader
        eyebrow="Stats"
        title="Your numbers"
        sub={`${s.total.games.toLocaleString()} games${colorWord ? ` ${colorWord}` : ""}${f.speed !== "all" ? ` in ${SPEED_LABEL[f.speed].toLowerCase()}` : ""}.`}
      />

      {/* Filters */}
      <div className="sticky top-14 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-ink/90 px-1 py-3 backdrop-blur md:top-0">
        <Seg
          value={f.color}
          onChange={(v) => set("color", v as ColorFilter)}
          options={[
            ["all", "Total"],
            ["w", "White"],
            ["b", "Black"],
          ]}
        />
        <Seg
          value={f.speed}
          onChange={(v) => set("speed", v as StatsFilter["speed"])}
          options={[["all", "All"], ...ratings.map((r) => [r.speed, SPEED_LABEL[r.speed]] as [string, string])]}
        />
        <Seg
          value={f.period}
          onChange={(v) => set("period", v as Period)}
          options={[
            ["30", "30d"],
            ["90", "90d"],
            ["365", "1y"],
            ["all", "All time"],
          ]}
        />
        {accountIds.length > 1 && (
          <select
            className="rounded-full border border-line bg-panel px-3 py-2 text-xs text-cream outline-none focus:border-brass"
            value={f.account}
            onChange={(e) => set("account", e.target.value)}
          >
            <option value="all">All accounts</option>
            {accountIds.map((id) => (
              <option key={id} value={id}>
                {accountName(id)}
              </option>
            ))}
          </select>
        )}
        <label className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-xs text-muted">
          <input type="checkbox" className="accent-[#e0ad4f]" checked={f.ratedOnly} onChange={(e) => set("ratedOnly", e.target.checked)} />
          Rated only
        </label>
      </div>

      {!s.total.games ? (
        <div className="mt-6">
          <EmptyState title="No games match">Try a wider date range or another time control.</EmptyState>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {/* Ratings, one section per site: Chess.com and Lichess ratings are on different scales. */}
          {bySite.map(({ site, label, ratings: siteRatings, series }) => (
            <Card key={site}>
              <SectionTitle title={`${label} rating`} sub="Rated games only. Last rating of each day." />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {siteRatings.map((r) => (
              <button
                key={r.speed}
                onClick={() => set("speed", f.speed === r.speed ? "all" : r.speed)}
                className={`rounded-2xl border bg-raised p-4 text-left transition hover:border-faint ${f.speed === r.speed ? "border-brass" : "border-line"}`}
              >
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-faint">
                  <span className="h-2 w-2 rounded-full" style={{ background: SPEED_COLOR[r.speed] }} />
                  {SPEED_LABEL[r.speed]}
                </div>
                <div className="font-display tabular mt-2 flex items-baseline gap-2 text-3xl text-cream">
                  {r0(r.current)}
                  {r.change30 !== undefined && r.change30 !== 0 && (
                    <span className={`text-sm ${r.change30 > 0 ? "text-sage" : "text-coral"}`}>
                      {r.change30 > 0 ? "+" : ""}
                      {r.change30}
                    </span>
                  )}
                </div>
                <div className="tabular mt-2 space-y-0.5 text-xs text-muted">
                  {r.best && (
                    <div>
                      Best <span className="text-cream">{r.best.rating}</span> · {fmtDate(r.best.at)}
                    </div>
                  )}
                  {r.lowest && (
                    <div>
                      Lowest <span className="text-cream">{r.lowest.rating}</span>
                    </div>
                  )}
                  <div>
                    {r.games.toLocaleString()} games · {p0(score(r.record))} score
                  </div>
                </div>
              </button>
            ))}
          </div>

              <div className="mt-5">
                <LineChart
                  series={series.map((x) => ({
                    key: x.speed,
                    label: SPEED_LABEL[x.speed],
                    color: SPEED_COLOR[x.speed],
                    points: x.points.map((p) => ({ x: p.t, y: p.r })),
                  }))}
                  formatX={fmtDate}
                />
              </div>
            </Card>
          ))}

          {/* Results + colors */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle title="Results" />
              <WDLBlock label="Total" r={s.total} big />
              {f.color === "all" && (
                <div className="mt-5 space-y-4">
                  <WDLBlock label="As White" r={s.byColor.w} />
                  <WDLBlock label="As Black" r={s.byColor.b} />
                </div>
              )}
            </Card>
            <Card>
              <SectionTitle title="Streaks" />
              <div className="grid grid-cols-2 gap-3">
                <Mini label="Longest win streak" value={s.streaks.longestWin} tone="text-sage" />
                <Mini label="Longest losing streak" value={s.streaks.longestLoss} tone="text-coral" />
                <Mini label="Longest unbeaten run" value={s.streaks.longestUnbeaten} />
                <Mini
                  label="Current streak"
                  value={
                    s.streaks.current
                      ? `${s.streaks.current.length} ${s.streaks.current.kind === "win" ? "W" : s.streaks.current.kind === "loss" ? "L" : "D"}`
                      : "–"
                  }
                  tone={s.streaks.current?.kind === "win" ? "text-sage" : s.streaks.current?.kind === "loss" ? "text-coral" : ""}
                />
              </div>
              <div className="mt-4 text-xs text-muted">
                Average opponent rating <span className="tabular text-cream">{r0(s.avgOpponent)}</span>
              </div>
            </Card>
          </div>

          {/* How games end */}
          <Card>
            <SectionTitle title="How games end" />
            <div className="grid gap-6 md:grid-cols-3">
              {(["win", "draw", "loss"] as const).map((res) => {
                const list = s.endings[res];
                const n = s.total[res];
                return (
                  <div key={res}>
                    <div className="mb-3 text-sm text-cream">
                      {res === "win" ? "Wins" : res === "loss" ? "Losses" : "Draws"}{" "}
                      <span className="tabular text-faint">{n.toLocaleString()}</span>
                    </div>
                    {list.length ? (
                      <ul className="space-y-2">
                        {list.map((e) => (
                          <li key={e.ending}>
                            <div className="flex justify-between text-xs text-muted">
                              <span>{ENDING_LABEL[e.ending]}</span>
                              <span className="tabular">
                                {e.count} · {p0(pct(e.count, n))}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-line">
                              <div className="h-1.5 rounded-full" style={{ width: `${pct(e.count, n)}%`, background: RES_COLOR[res] }} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-faint">None</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Best wins / toughest losses */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GameList title="Best wins" sub="Highest-rated opponents you beat." games={s.bestWins} go={go} />
            <GameList title="Toughest losses" sub="Lowest-rated opponents you lost to." games={s.worstLosses} go={go} />
          </div>

          {/* Opponent strength */}
          <Card>
            <SectionTitle title="Results by opponent strength" sub="Opponent's rating compared with yours at the time." />
            <BucketBars buckets={s.vsStrength} />
          </Card>

          {/* Openings */}
          <OpeningsTable rows={s.openings} />

          {/* Accuracy */}
          <Card>
            <SectionTitle
              title="Accuracy"
              sub={`From ${s.accuracy.analysed.toLocaleString()} of ${s.total.games.toLocaleString()} games reviewed by Stockfish.`}
            />
            {s.accuracy.analysed ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Mini label="Average" value={`${r0(s.accuracy.average)}%`} />
                  <Mini label="In wins" value={`${r0(s.accuracy.byResult.win)}%`} tone="text-sage" />
                  <Mini label="In draws" value={`${r0(s.accuracy.byResult.draw)}%`} />
                  <Mini label="In losses" value={`${r0(s.accuracy.byResult.loss)}%`} tone="text-coral" />
                </div>
                {s.accuracy.bySpeed.length > 1 && (
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
                    {s.accuracy.bySpeed.map((x) => (
                      <span key={x.speed} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: SPEED_COLOR[x.speed] }} />
                        {SPEED_LABEL[x.speed]} <span className="tabular text-cream">{Math.round(x.accuracy)}%</span>
                        <span className="text-faint">({x.games})</span>
                      </span>
                    ))}
                  </div>
                )}
                {s.accuracy.monthly.length > 1 && (
                  <div className="mt-5">
                    <LineChart
                      height={180}
                      series={[
                        {
                          key: "acc",
                          label: "Accuracy",
                          color: "var(--color-brass)",
                          points: s.accuracy.monthly.map((m) => ({ x: m.month, y: m.accuracy })),
                        },
                      ]}
                      formatX={fmtMonth}
                      formatY={(y) => `${Math.round(y)}%`}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-faint">No reviewed games yet. The engine review runs in the background.</div>
            )}
          </Card>

          {/* Activity */}
          <Card>
            <SectionTitle title="Activity" sub="Games per month, coloured by result." />
            <MonthBars months={s.monthly} />
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle title="By day of week" />
              <BucketBars buckets={s.weekday} />
            </Card>
            <Card>
              <SectionTitle title="By hour of day" sub="Your local time." />
              <HourGrid buckets={s.hour} />
            </Card>
          </div>

          {/* Game length */}
          <Card>
            <SectionTitle title="Game length" sub="In full moves." />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Mini label="Avg win" value={r0(s.length.byResult.win)} tone="text-sage" />
              <Mini label="Avg draw" value={r0(s.length.byResult.draw)} />
              <Mini label="Avg loss" value={r0(s.length.byResult.loss)} tone="text-coral" />
              <Mini
                label="Fastest win"
                value={s.length.shortestWin ? s.length.shortestWin.moves : "–"}
                onClick={s.length.shortestWin ? () => go("games", s.length.shortestWin!.game.id) : undefined}
              />
            </div>
            <div className="mt-5">
              <BucketBars buckets={s.length.buckets} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Seg({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="flex flex-wrap rounded-full border border-line bg-panel p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1.5 text-xs transition ${value === v ? "bg-raised text-cream" : "text-muted hover:text-cream"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-xl text-cream">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-faint">{sub}</p>}
    </div>
  );
}

function Mini({
  label,
  value,
  tone = "text-cream",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`rounded-xl bg-raised p-3 text-left ${onClick ? "transition hover:bg-line" : ""}`}>
      <div className="text-[11px] text-faint">{label}</div>
      <div className={`font-display tabular mt-1 text-2xl ${tone || "text-cream"}`}>{value}</div>
    </Tag>
  );
}

function ResultBar({ r, h = "h-2.5" }: { r: WDL; h?: string }) {
  return (
    <div className={`flex ${h} overflow-hidden rounded-full bg-line`}>
      {(["win", "draw", "loss"] as const).map((k) => (
        <div key={k} style={{ width: `${pct(r[k], r.games)}%`, background: RES_COLOR[k] }} />
      ))}
    </div>
  );
}

function WDLBlock({ label, r, big }: { label: string; r: WDL; big?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className={big ? "text-sm text-cream" : "text-xs text-muted"}>
          {label} <span className="tabular text-faint">{r.games.toLocaleString()}</span>
        </span>
        <span className="tabular text-xs text-muted">score {p0(score(r))}</span>
      </div>
      <ResultBar r={r} h={big ? "h-3" : "h-2"} />
      <div className="tabular mt-2 flex gap-4 text-xs">
        <span className="text-sage">
          {r.win.toLocaleString()} won · {p0(pct(r.win, r.games))}
        </span>
        <span className="text-muted">
          {r.draw.toLocaleString()} drawn · {p0(pct(r.draw, r.games))}
        </span>
        <span className="text-coral">
          {r.loss.toLocaleString()} lost · {p0(pct(r.loss, r.games))}
        </span>
      </div>
    </div>
  );
}

function BucketBars({ buckets }: { buckets: (WDL & { label: string })[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.games));
  return (
    <ul className="space-y-2.5">
      {buckets.map((b) => (
        <li key={b.label} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3 text-xs">
          <span className="text-muted">{b.label}</span>
          <div style={{ width: `${Math.max(2, (b.games / max) * 100)}%` }}>
            {b.games ? <ResultBar r={b} /> : <div className="h-2.5 rounded-full bg-line" />}
          </div>
          <span className="tabular text-right text-faint">
            {b.games ? (
              <>
                <span className="text-cream">{p0(score(b))}</span> · {b.games}
              </>
            ) : (
              "–"
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function HourGrid({ buckets }: { buckets: (WDL & { label: string })[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.games));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {buckets.map((b) => (
          <div
            key={b.label}
            className="flex flex-1 flex-col justify-end"
            title={`${b.label}:00 · ${b.games} games · score ${p0(score(b))}`}
            style={{ height: "100%" }}
          >
            <div className="flex flex-col overflow-hidden rounded-sm" style={{ height: `${(b.games / max) * 100}%` }}>
              {(["win", "draw", "loss"] as const).map((k) => (
                <div key={k} style={{ height: `${pct(b[k], b.games)}%`, background: RES_COLOR[k] }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="tabular mt-2 flex justify-between text-[10px] text-faint">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

function MonthBars({ months }: { months: { month: number; record: WDL }[] }) {
  if (!months.length) return null;
  // Fill gaps so empty months show as empty.
  const all: { month: number; record: WDL }[] = [];
  const byMonth = new Map(months.map((m) => [m.month, m.record]));
  const d = new Date(months[0].month);
  const end = months[months.length - 1].month;
  while (d.getTime() <= end) {
    const t = d.getTime();
    all.push({ month: t, record: byMonth.get(t) ?? { games: 0, win: 0, draw: 0, loss: 0 } });
    d.setMonth(d.getMonth() + 1);
  }
  const max = Math.max(1, ...all.map((m) => m.record.games));
  const step = Math.max(1, Math.ceil(all.length / 8));
  return (
    <div>
      <div className="flex h-40 items-end gap-px">
        {all.map((m) => (
          <div
            key={m.month}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${fmtMonth(m.month)} · ${m.record.games} games · ${m.record.win}W ${m.record.draw}D ${m.record.loss}L`}
          >
            <div className="flex flex-col overflow-hidden rounded-t-sm" style={{ height: `${(m.record.games / max) * 100}%` }}>
              {(["win", "draw", "loss"] as const).map((k) => (
                <div key={k} style={{ height: `${pct(m.record[k], m.record.games)}%`, background: RES_COLOR[k] }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="tabular mt-2 flex text-[10px] text-faint">
        {all.map((m, i) => (
          <span key={m.month} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
            {i % step === 0 ? fmtMonth(m.month) : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted">
        Busiest month:{" "}
        {(() => {
          const top = all.reduce((a, b) => (b.record.games > a.record.games ? b : a));
          return (
            <span className="text-cream">
              {fmtMonth(top.month)} ({top.record.games} games)
            </span>
          );
        })()}
      </div>
    </div>
  );
}

function GameList({ title, sub, games, go }: { title: string; sub: string; games: StoredGame[]; go: Go }) {
  return (
    <Card>
      <SectionTitle title={title} sub={sub} />
      {games.length ? (
        <ul className="divide-y divide-line">
          {games.map((g) => {
            const opp = g.userColor === "w" ? g.black : g.white;
            return (
              <li key={g.id}>
                <button
                  onClick={() => go("games", g.id)}
                  className="flex w-full items-center gap-3 py-2.5 text-left text-sm transition hover:text-brass"
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-sm border border-line ${g.userColor === "w" ? "bg-cream" : "bg-ink"}`}
                    title={g.userColor === "w" ? "You had White" : "You had Black"}
                  />
                  <span className="min-w-0 flex-1 truncate text-cream">{opp}</span>
                  <span className="tabular text-brass">{g.opponentRating}</span>
                  <span className="tabular hidden w-24 text-right text-xs text-faint sm:inline">{fmtDate(g.playedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-sm text-faint">No rated games here yet.</div>
      )}
    </Card>
  );
}

type OpeningSort = "games" | "score" | "accuracy" | "name";

function Th({
  k,
  sort,
  setSort,
  children,
  className = "",
}: {
  k: OpeningSort;
  sort: OpeningSort;
  setSort: (k: OpeningSort) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 font-medium ${className}`}>
      <button onClick={() => setSort(k)} className={sort === k ? "text-brass" : "hover:text-cream"}>
        {children}
        {sort === k ? " ↓" : ""}
      </button>
    </th>
  );
}

function OpeningsTable({ rows }: { rows: ReturnType<typeof buildStats>["openings"] }) {
  const [sort, setSort] = useState<OpeningSort>("games");
  const [family, setFamily] = useState(true);
  const [limit, setLimit] = useState(12);

  const list = useMemo(() => {
    let base = rows;
    if (family) {
      const m = new Map<string, (typeof rows)[number] & { accSum: number }>();
      for (const r of rows) {
        const name = r.name.split(/[:,]/)[0].trim();
        const cur = m.get(name) ?? { name, games: 0, win: 0, draw: 0, loss: 0, analysed: 0, accSum: 0 };
        cur.games += r.games;
        cur.win += r.win;
        cur.draw += r.draw;
        cur.loss += r.loss;
        cur.analysed += r.analysed;
        cur.accSum += (r.accuracy ?? 0) * r.analysed;
        m.set(name, cur);
      }
      base = [...m.values()].map(({ accSum, ...r }) => ({ ...r, accuracy: r.analysed ? accSum / r.analysed : undefined }));
    }
    const key = (r: (typeof rows)[number]) =>
      sort === "games" ? r.games : sort === "score" ? score(r) : sort === "accuracy" ? (r.accuracy ?? -1) : 0;
    return [...base].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : key(b) - key(a) || b.games - a.games));
  }, [rows, sort, family]);

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 pb-3">
        <SectionTitle title="Openings" sub={`${list.length} ${family ? "opening families" : "openings"}. Click a column to sort.`} />
        <Seg
          value={family ? "f" : "v"}
          onChange={(v) => setFamily(v === "f")}
          options={[
            ["f", "Families"],
            ["v", "Variations"],
          ]}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-y border-line text-left text-xs text-faint">
            <tr>
              <Th sort={sort} setSort={setSort} k="name">Opening</Th>
              <Th sort={sort} setSort={setSort} k="games" className="text-right">
                Games
              </Th>
              <th className="w-40 px-3 py-2 font-medium">W / D / L</th>
              <Th sort={sort} setSort={setSort} k="score" className="text-right">
                Score
              </Th>
              <Th sort={sort} setSort={setSort} k="accuracy" className="text-right">
                Accuracy
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.slice(0, limit).map((r) => (
              <tr key={r.name}>
                <td className="max-w-[18rem] truncate px-3 py-2.5 text-cream" title={r.name}>
                  {r.name}
                </td>
                <td className="tabular px-3 py-2.5 text-right text-muted">{r.games}</td>
                <td className="px-3 py-2.5" title={`${r.win} won, ${r.draw} drawn, ${r.loss} lost`}>
                  <ResultBar r={r} h="h-2" />
                </td>
                <td className="tabular px-3 py-2.5 text-right text-cream">{p0(score(r))}</td>
                <td className="tabular px-3 py-2.5 text-right text-muted">
                  {r.accuracy !== undefined ? `${Math.round(r.accuracy)}%` : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > limit && (
        <div className="p-3 text-center">
          <button className="text-xs text-muted hover:text-cream" onClick={() => setLimit((l) => l + 25)}>
            Show more
          </button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Line chart (own SVG, no library)                                     */
/* ------------------------------------------------------------------ */

interface Series {
  key: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

function LineChart({
  series,
  height = 260,
  formatX,
  formatY = (y) => String(Math.round(y)),
}: {
  series: Series[];
  height?: number;
  formatX: (x: number) => string;
  formatY?: (y: number) => string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.filter((s) => !hidden.has(s.key) && s.points.length);
  const W = 800;
  const H = height;
  const pad = { l: 44, r: 12, t: 10, b: 24 };

  const pts = shown.flatMap((s) => s.points);
  if (!series.some((s) => s.points.length)) {
    return <div className="py-10 text-center text-sm text-faint">No rated games in this selection.</div>;
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = pts.length ? Math.min(...xs) : 0;
  const x1 = pts.length ? Math.max(...xs) : 1;
  const yMin = pts.length ? Math.min(...ys) : 0;
  const yMax = pts.length ? Math.max(...ys) : 1;
  const ySpan = Math.max(10, yMax - yMin);
  const lo = yMin - ySpan * 0.08;
  const hi = yMax + ySpan * 0.08;
  const sx = (x: number) => pad.l + ((x - x0) / Math.max(1, x1 - x0)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setHover(x0 + ((x - pad.l) / (W - pad.l - pad.r)) * (x1 - x0));
  };
  const nearest = (s: Series) =>
    hover === null
      ? null
      : s.points.reduce((a, b) => (Math.abs(b.x - hover) < Math.abs(a.x - hover) ? b : a), s.points[0]);

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {series.map((s) => (
            <button
              key={s.key}
              onClick={() =>
                setHidden((h) => {
                  const n = new Set(h);
                  if (n.has(s.key)) n.delete(s.key);
                  else n.add(s.key);
                  return n;
                })
              }
              className={`flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs transition ${hidden.has(s.key) ? "text-faint" : "text-cream"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: hidden.has(s.key) ? "var(--color-line)" : s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={pad.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-faint)">
              {formatY(t)}
            </text>
          </g>
        ))}
        {pts.length > 0 && (
          <>
            <text x={pad.l} y={H - 6} fontSize="11" fill="var(--color-faint)">
              {formatX(x0)}
            </text>
            <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="11" fill="var(--color-faint)">
              {formatX(x1)}
            </text>
          </>
        )}
        {shown.map((s) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")}
          />
        ))}
        {hover !== null &&
          shown.map((s) => {
            const p = nearest(s);
            return p ? <circle key={s.key} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={s.color} stroke="var(--color-panel)" strokeWidth="2" /> : null;
          })}
      </svg>
      <div className="tabular mt-1 h-4 text-xs text-muted">
        {hover !== null &&
          shown.map((s) => {
            const p = nearest(s);
            return p ? (
              <span key={s.key} className="mr-4">
                <span style={{ color: s.color }}>{s.label}</span> {formatY(p.y)} · {formatX(p.x)}
              </span>
            ) : null;
          })}
      </div>
    </div>
  );
}
