"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { STYLE_LABEL, type Story, type Style } from "@/lib/story";
import { MOTIF_LABEL } from "@/lib/labels";
import { useStore } from "./store";
import { MomentBoard } from "./MomentBoard";
import { Button, EmptyState, Ring, moveNumber } from "./ui";
import type { Go } from "./App";

const BACKDROPS = [
  "radial-gradient(120% 80% at 20% 0%, #3a2a14 0%, #14110f 60%)",
  "radial-gradient(120% 80% at 80% 10%, #1f2d22 0%, #14110f 60%)",
  "radial-gradient(120% 80% at 50% 0%, #3d2a10 0%, #14110f 65%)",
  "radial-gradient(120% 80% at 10% 20%, #22252f 0%, #14110f 60%)",
  "radial-gradient(120% 80% at 70% 0%, #4a3412 0%, #14110f 62%)",
  "radial-gradient(120% 80% at 30% 10%, #1d2a20 0%, #14110f 60%)",
  "radial-gradient(120% 80% at 60% 0%, #3b1c17 0%, #14110f 62%)",
  "radial-gradient(120% 80% at 40% 0%, #2a2318 0%, #14110f 60%)",
  "radial-gradient(120% 80% at 50% 0%, #3a2a14 0%, #14110f 60%)",
];

export function usePlayerName() {
  const { accounts } = useStore();
  const real = accounts.find((a) => a.id !== "demo");
  return real?.username ?? (accounts.length ? "Demo player" : "You");
}

export function StoryView({ go }: { go: Go }) {
  const { story, games, queue } = useStore();
  const name = usePlayerName();
  const [i, setI] = useState(0);

  const slides = story ? buildSlides(story, name, go) : [];
  const n = slides.length;
  const next = useCallback(() => setI((x) => Math.min(n - 1, x + 1)), [n]);
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") go("home");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go]);

  if (!story) {
    const reviewed = games.length - queue.remaining;
    return (
      <EmptyState
        title="Your story is being written"
        action={
          <Button variant="ghost" onClick={() => go("games")}>
            Browse your games
          </Button>
        }
      >
        Stockfish needs to review at least 3 games before it can tell your story ({reviewed} done so far). It keeps
        working in the background while this tab is open.
      </EmptyState>
    );
  }

  // Portal to <body> so the overlay escapes the page's stacking context and covers the navigation.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col text-cream transition-[background] duration-700"
      style={{ background: BACKDROPS[i % BACKDROPS.length] }}
    >
      <div className="mx-auto flex w-full max-w-5xl gap-1.5 px-5 pt-5">
        {slides.map((_, k) => (
          <button
            key={k}
            aria-label={`Slide ${k + 1}`}
            onClick={() => setI(k)}
            className="h-1 flex-1 overflow-hidden rounded-full bg-cream/15"
          >
            <div className={`h-full rounded-full bg-cream transition-all duration-500 ${k <= i ? "w-full" : "w-0"}`} />
          </button>
        ))}
      </div>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-4 text-sm text-muted">
        <span>{name}&apos;s chess story</span>
        <button aria-label="Close" className="rounded-full px-2 text-xl hover:text-cream" onClick={() => go("home")}>
          ×
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        <div key={i} className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-6 py-8">
          {slides[i]}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 pb-6">
        <Button variant="quiet" onClick={prev} disabled={i === 0}>
          ← Back
        </Button>
        <span className="tabular text-xs text-faint">
          {i + 1} / {n}
        </span>
        {i < n - 1 ? (
          <Button onClick={next}>Next →</Button>
        ) : (
          <Button variant="ghost" onClick={() => go("home")}>
            Done
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Rise({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`animate-rise ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brass">{children}</div>
);

function buildSlides(s: Story, name: string, go: Go): React.ReactNode[] {
  const slides: React.ReactNode[] = [];
  slides.push(
    <div key="intro" className="text-center">
      <Rise>
        <Kicker>Your chess story</Kicker>
      </Rise>
      <Rise delay={150}>
        <h2 className="font-display mt-6 text-6xl leading-none md:text-8xl">
          <span className="tabular text-brass">{s.games.toLocaleString()}</span> games.
        </h2>
      </Rise>
      <Rise delay={350}>
        <p className="font-display mt-4 text-3xl text-cream/80 md:text-4xl">One way of playing.</p>
      </Rise>
      <Rise delay={600}>
        <p className="mx-auto mt-10 max-w-md text-muted">
          Stockfish reviewed {s.analysed.toLocaleString()} of them, move by move. Here&apos;s what it found about how{" "}
          {name === "You" ? "you play" : `${name} plays`}.
        </p>
      </Rise>
    </div>,
  );

  if (s.favouriteFirstMove) {
    slides.push(
      <div key="first" className="text-center">
        <Rise>
          <Kicker>Your signature</Kicker>
        </Rise>
        <Rise delay={150}>
          <p className="mt-6 text-lg text-muted">As White, your first move is</p>
        </Rise>
        <Rise delay={300}>
          <div className="font-display mt-4 text-[8rem] leading-none text-brass md:text-[11rem]">
            1.{s.favouriteFirstMove.san}
          </div>
        </Rise>
        <Rise delay={500}>
          <p className="mt-4 text-lg text-cream/80">
            in <span className="tabular text-cream">{s.favouriteFirstMove.share}%</span> of your games.
          </p>
        </Rise>
        {s.sacrifices > 0 && (
          <Rise delay={700}>
            <p className="mx-auto mt-10 max-w-md text-muted">
              You also offered material <span className="tabular text-cream">{s.sacrifices}</span> time
              {s.sacrifices === 1 ? "" : "s"}, and the engine agreed it was the right call.
            </p>
          </Rise>
        )}
      </div>,
    );
  }

  slides.push(
    <div key="score" className="flex flex-col items-center text-center">
      <Rise>
        <Kicker>Your coach score</Kicker>
      </Rise>
      <Rise delay={200} className="mt-8">
        <Ring value={s.score} size={220} stroke={10}>
          <div>
            <div className="font-display tabular text-7xl text-cream">{s.score}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted">out of 100</div>
          </div>
        </Ring>
      </Rise>
      <Rise delay={500}>
        <p className="font-display mt-8 text-3xl">{s.tier.name} tier</p>
        {s.tier.next && (
          <p className="mt-2 text-sm text-muted">
            {s.tier.next.at - s.score} points to {s.tier.next.name}
          </p>
        )}
      </Rise>
      <Rise delay={700} className="mt-10 grid w-full max-w-lg grid-cols-2 gap-3 text-left sm:grid-cols-4">
        {s.scoreParts.map((p) => (
          <div key={p.label} className="rounded-2xl border border-cream/10 bg-cream/[0.03] p-3">
            <div className="font-display tabular text-2xl">{p.value}</div>
            <div className="text-xs text-muted">{p.label}</div>
          </div>
        ))}
      </Rise>
    </div>,
  );

  slides.push(
    <div key="style">
      <Rise>
        <Kicker>Your style</Kicker>
      </Rise>
      <Rise delay={150}>
        <h2 className="font-display mt-4 text-4xl md:text-5xl">How you play, in seven lines.</h2>
      </Rise>
      <div className="mt-10 flex flex-col gap-5">
        {(Object.keys(STYLE_LABEL) as (keyof Style)[]).map((k, idx) => (
          <Rise key={k} delay={300 + idx * 90}>
            <StyleBar k={k} v={s.style[k]} legend={s.legend.style[k]} />
          </Rise>
        ))}
      </div>
      <Rise delay={1000}>
        <p className="mt-8 flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-3 w-0.5 bg-cream/60" /> marks {s.legend.name}
        </p>
      </Rise>
    </div>,
  );

  slides.push(
    <div key="legend" className="text-center">
      <Rise>
        <Kicker>Your chess legend</Kicker>
      </Rise>
      <Rise delay={200}>
        <p className="mt-6 text-lg text-muted">You play like</p>
      </Rise>
      <Rise delay={400}>
        <h2 className="font-display mt-2 text-6xl leading-none text-brass md:text-8xl">{s.legend.name}</h2>
      </Rise>
      <Rise delay={600}>
        <p className="mt-4 text-sm uppercase tracking-[0.18em] text-cream/70">
          {s.legend.nickname} · {s.legend.years}
        </p>
      </Rise>
      <Rise delay={800}>
        <p className="font-display mx-auto mt-10 max-w-xl text-2xl leading-snug text-cream/90">“{s.legend.blurb}”</p>
      </Rise>
      <Rise delay={1000} className="mt-10 flex items-center justify-center gap-6 text-sm">
        <span>
          <span className="font-display tabular text-3xl text-cream">{s.match}%</span>
          <span className="ml-2 text-muted">style match</span>
        </span>
        <span className="h-8 w-px bg-cream/15" />
        <span className="text-muted">
          Runner-up: <span className="text-cream">{s.runnerUp.name}</span>
        </span>
      </Rise>
    </div>,
  );

  if (s.brilliant) {
    const opp = s.brilliant.game.userColor === "w" ? s.brilliant.game.black : s.brilliant.game.white;
    slides.push(
      <div key="brilliant" className="grid items-center gap-10 md:grid-cols-[1fr_1.5fr]">
        <div>
          <Rise>
            <Kicker>Your boldest move</Kicker>
          </Rise>
          <Rise delay={150}>
            <h2 className="font-display mt-4 text-5xl">
              {moveNumber(s.brilliant.move.ply)} {s.brilliant.move.san}
            </h2>
          </Rise>
          <Rise delay={300}>
            <p className="mt-4 text-muted">
              Against {opp}, you put a piece where it could be taken. Stockfish approved. The green arrow is the move
              you played.
            </p>
          </Rise>
        </div>
        <Rise delay={200}>
          <MomentBoard id="story-brilliant" game={s.brilliant.game} move={s.brilliant.move} showPlayed={false} />
        </Rise>
      </div>,
    );
  } else if (s.finest) {
    const g = s.finest;
    slides.push(
      <div key="finest" className="text-center">
        <Rise>
          <Kicker>Your finest game</Kicker>
        </Rise>
        <Rise delay={200}>
          <div className="font-display tabular mt-6 text-8xl text-sage">{g.analysis!.accuracy}%</div>
        </Rise>
        <Rise delay={400}>
          <p className="mt-4 text-lg text-cream/80">
            accuracy in your win against {g.userColor === "w" ? g.black : g.white}, playing the {g.opening}.
          </p>
        </Rise>
        <Rise delay={600}>
          <Button variant="ghost" className="mt-8" onClick={() => go("games", g.id)}>
            Replay it
          </Button>
        </Rise>
      </div>,
    );
  }

  if (s.costliest) {
    const c = s.costliest;
    const opp = c.game.userColor === "w" ? c.game.black : c.game.white;
    slides.push(
      <div key="costliest" className="grid items-center gap-10 md:grid-cols-[1fr_1.5fr]">
        <div>
          <Rise>
            <Kicker>Your costliest mistake</Kicker>
          </Rise>
          <Rise delay={150}>
            <h2 className="font-display mt-4 text-5xl">
              {moveNumber(c.move.ply)} <span className="text-coral">{c.move.san}??</span>
            </h2>
          </Rise>
          <Rise delay={300}>
            <p className="mt-4 text-lg text-cream/85">
              {c.wasWinning ? (
                <>
                  You had a <span className="tabular text-cream">{c.winBefore}%</span> chance to win against {opp}. One
                  move later it dropped by <span className="tabular text-coral">{Math.round(c.move.winDrop)}</span>{" "}
                  points.
                </>
              ) : (
                <>
                  This one move against {opp} cost you{" "}
                  <span className="tabular text-coral">{Math.round(c.move.winDrop)}</span> points of win chance.
                </>
              )}
            </p>
          </Rise>
          <Rise delay={450}>
            <p className="mt-4 text-muted">
              {c.move.explanation ?? (c.move.motif ? MOTIF_LABEL[c.move.motif].label : "")} The green arrow,{" "}
              <span className="font-semibold text-sage">{c.move.bestSan}</span>, kept you in the game.
            </p>
          </Rise>
          <Rise delay={600}>
            <p className="mt-6 text-sm text-faint">
              {c.lostGame ? "You went on to lose that game." : "You still won it. Lucky."}
            </p>
          </Rise>
        </div>
        <Rise delay={200}>
          <MomentBoard id="story-costliest" game={c.game} move={c.move} />
        </Rise>
      </div>,
    );
  }

  if (s.bestOpening) {
    slides.push(
      <div key="openings">
        <Rise>
          <Kicker>Your openings</Kicker>
        </Rise>
        <Rise delay={150}>
          <h2 className="font-display mt-4 text-4xl md:text-5xl">Where you shine, and where you don&apos;t.</h2>
        </Rise>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Rise delay={300}>
            <div className="rounded-3xl border border-sage/30 bg-sage/[0.06] p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-sage">Your weapon</div>
              <div className="font-display mt-3 text-3xl">{s.bestOpening.name}</div>
              <div className="mt-1 text-sm text-muted">as {s.bestOpening.color === "w" ? "White" : "Black"}</div>
              <div className="font-display tabular mt-6 text-5xl text-sage">{s.bestOpening.score}%</div>
              <div className="text-sm text-muted">score in {s.bestOpening.games} games</div>
            </div>
          </Rise>
          {s.worstOpening && (
            <Rise delay={450}>
              <div className="rounded-3xl border border-coral/30 bg-coral/[0.06] p-6">
                <div className="text-xs uppercase tracking-[0.16em] text-coral">Your kryptonite</div>
                <div className="font-display mt-3 text-3xl">{s.worstOpening.name}</div>
                <div className="mt-1 text-sm text-muted">as {s.worstOpening.color === "w" ? "White" : "Black"}</div>
                <div className="font-display tabular mt-6 text-5xl text-coral">{s.worstOpening.score}%</div>
                <div className="text-sm text-muted">score in {s.worstOpening.games} games</div>
              </div>
            </Rise>
          )}
        </div>
      </div>,
    );
  }

  slides.push(<ShareSlide key="share" s={s} name={name} go={go} />);
  return slides;
}

function StyleBar({ k, v, legend }: { k: keyof Style; v: number; legend: number }) {
  const l = STYLE_LABEL[k];
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-cream">{l.name}</span>
        <span className="text-xs text-muted">{v >= 0.5 ? l.high : l.low}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-cream/10">
        <div
          className="h-2 rounded-full bg-brass transition-all duration-1000"
          style={{ width: `${Math.max(4, v * 100)}%` }}
        />
        <div className="absolute -top-1 h-4 w-0.5 bg-cream/60" style={{ left: `${legend * 100}%` }} />
      </div>
    </div>
  );
}

function ShareSlide({ s, name, go }: { s: Story; name: string; go: Go }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const share = async () => {
    setBusy(true);
    try {
      const blob = await drawShareCard(s, name);
      const file = new File([blob], "my-chess-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My chess story" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        setMsg("Image saved.");
      }
    } catch {
      /* share sheet dismissed */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-center text-center">
      <Rise>
        <Kicker>That&apos;s your story</Kicker>
      </Rise>
      <Rise delay={150} className="mt-8 w-full max-w-sm">
        <div className="rounded-[28px] border border-cream/10 bg-gradient-to-b from-[#2a2117] to-[#16120f] p-7 text-left shadow-2xl">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>♞ Chess Coach</span>
            <span>{name}</span>
          </div>
          <div className="mt-8 text-xs uppercase tracking-[0.16em] text-faint">Plays like</div>
          <div className="font-display text-4xl text-brass">{s.legend.name}</div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-faint">Score</div>
              <div className="font-display tabular text-4xl">{s.score}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-faint">Tier</div>
              <div className="font-display text-4xl">{s.tier.name}</div>
            </div>
          </div>
          {s.costliest && (
            <div className="mt-6 border-t border-cream/10 pt-4 text-sm text-muted">
              Costliest mistake:{" "}
              <span className="text-coral">
                {moveNumber(s.costliest.move.ply)} {s.costliest.move.san}
              </span>
            </div>
          )}
        </div>
      </Rise>
      <Rise delay={400} className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={share} disabled={busy}>
          {busy ? "Making image…" : "Share my story"}
        </Button>
        <Button variant="ghost" onClick={() => go("course")}>
          Start my course
        </Button>
      </Rise>
      {msg && <p className="mt-3 text-sm text-sage">{msg}</p>}
    </div>
  );
}

/** Draws a 1080×1350 share image on a canvas. */
async function drawShareCard(s: Story, name: string): Promise<Blob> {
  await document.fonts.ready;
  const W = 1080;
  const H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const x = cv.getContext("2d")!;
  const g = x.createRadialGradient(W * 0.3, 0, 50, W * 0.3, 0, H);
  g.addColorStop(0, "#4a3412");
  g.addColorStop(0.6, "#14110f");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  const serif = '"Fraunces Variable", Georgia, serif';
  const sans = '"Inter Variable", system-ui, sans-serif';
  x.fillStyle = "#a89c8d";
  x.font = `500 32px ${sans}`;
  x.fillText("♞  CHESS COACH", 90, 120);
  x.textAlign = "right";
  x.fillText(name, W - 90, 120);
  x.textAlign = "left";

  x.font = `600 30px ${sans}`;
  x.fillStyle = "#e0ad4f";
  x.fillText("PLAYS LIKE", 90, 330);
  x.font = `400 120px ${serif}`;
  x.fillStyle = "#f3ece1";
  const words = s.legend.name.split(" ");
  const last = words.pop()!;
  x.fillText(words.join(" "), 90, 460);
  x.fillStyle = "#e0ad4f";
  x.fillText(last, 90, 590);
  x.font = `400 34px ${sans}`;
  x.fillStyle = "#a89c8d";
  x.fillText(`${s.match}% style match · ${s.legend.nickname}`, 90, 650);

  const stat = (label: string, value: string, cx: number) => {
    x.font = `600 28px ${sans}`;
    x.fillStyle = "#6f655a";
    x.fillText(label, cx, 820);
    x.font = `400 130px ${serif}`;
    x.fillStyle = "#f3ece1";
    x.fillText(value, cx, 950);
  };
  stat("SCORE", String(s.score), 90);
  stat("TIER", s.tier.name, 560);

  x.fillStyle = "rgba(243,236,225,0.12)";
  x.fillRect(90, 1040, W - 180, 2);
  if (s.costliest) {
    x.font = `400 36px ${sans}`;
    x.fillStyle = "#a89c8d";
    x.fillText("Costliest mistake", 90, 1120);
    x.fillStyle = "#e8745e";
    x.font = `400 64px ${serif}`;
    x.fillText(`${moveNumber(s.costliest.move.ply)} ${s.costliest.move.san}??`, 90, 1200);
  }
  x.font = `400 28px ${sans}`;
  x.fillStyle = "#6f655a";
  x.fillText(`${s.games.toLocaleString()} games reviewed by Stockfish`, 90, H - 70);

  return new Promise((res) => cv.toBlob((b) => res(b!), "image/png"));
}
