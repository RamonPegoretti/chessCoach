"use client";

import type { MoveClass, Result } from "@/lib/types";
import { MATE_SCORE } from "@/lib/types";
import { winChance } from "@/lib/analysis";

export const CLASS_STYLE: Record<MoveClass, { label: string; color: string; symbol: string }> = {
  best: { label: "Best", color: "text-sage", symbol: "" },
  good: { label: "Good", color: "text-cream/80", symbol: "" },
  inaccuracy: { label: "Inaccuracy", color: "text-amber", symbol: "?!" },
  mistake: { label: "Mistake", color: "text-[#f0a35e]", symbol: "?" },
  blunder: { label: "Blunder", color: "text-coral", symbol: "??" },
};

export const RESULT_STYLE: Record<Result, string> = {
  win: "bg-sage/15 text-sage",
  loss: "bg-coral/15 text-coral",
  draw: "bg-cream/10 text-muted",
};

/** Warm wooden board shared by every Chessboard in the app. */
export const BOARD = {
  darkSquareStyle: { backgroundColor: "#a77b56" },
  lightSquareStyle: { backgroundColor: "#ecdcc0" },
  darkSquareNotationStyle: { color: "#ecdcc0", fontWeight: 600 },
  lightSquareNotationStyle: { color: "#a77b56", fontWeight: 600 },
  boardStyle: { borderRadius: "10px", overflow: "hidden", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.7)" },
};
export const ARROW_GOOD = "rgba(140,192,132,0.9)";
export const ARROW_BAD = "rgba(232,116,94,0.85)";

export function formatEval(cp: number): string {
  if (cp >= MATE_SCORE - 1000) return `M${MATE_SCORE - cp}`;
  if (cp <= -(MATE_SCORE - 1000)) return `-M${MATE_SCORE + cp}`;
  const v = cp / 100;
  return (v > 0 ? "+" : "") + v.toFixed(1);
}

/** Vertical bar: white share = White's win chance. */
export function EvalBar({ cp, flipped }: { cp: number; flipped: boolean }) {
  const white = winChance(cp);
  return (
    <div
      className={`relative w-3 shrink-0 overflow-hidden rounded-full bg-[#2a2420] ${flipped ? "" : "rotate-180"}`}
      title={formatEval(cp)}
    >
      <div className="absolute inset-x-0 top-0 bg-cream transition-all duration-500" style={{ height: `${white}%` }} />
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel p-5 ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "quiet"; size?: "md" | "lg" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
  const sizes = size === "lg" ? "px-6 py-3 text-base" : "px-4 py-2 text-sm";
  const styles =
    variant === "primary"
      ? "bg-brass text-ink hover:bg-[#ebbd63]"
      : variant === "ghost"
        ? "border border-line text-cream hover:border-faint hover:bg-raised"
        : "text-muted hover:text-cream";
  return (
    <button {...props} className={`${base} ${sizes} ${styles} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="font-display tabular mt-2 text-3xl text-cream">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-xs font-semibold uppercase tracking-[0.16em] text-brass ${className}`}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-display mt-2 text-4xl leading-tight text-cream md:text-5xl">{title}</h1>
        {sub && <p className="mt-3 text-base text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** Circular progress / score ring. */
export function Ring({
  value,
  size = 120,
  stroke = 8,
  color = "var(--color-brass)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, value)) / 100)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <div className="font-display text-5xl text-faint">♞</div>
      <h2 className="font-display mt-4 text-2xl text-cream">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export const moveNumber = (ply: number) => `${Math.floor(ply / 2) + 1}${ply % 2 ? "…" : "."}`;
