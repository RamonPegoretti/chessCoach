"use client";

import type { MoveClass, Result } from "@/lib/types";
import { MATE_SCORE } from "@/lib/types";
import { winChance } from "@/lib/analysis";

export const CLASS_STYLE: Record<MoveClass, { label: string; color: string; symbol: string }> = {
  best: { label: "Best", color: "text-emerald-400", symbol: "" },
  good: { label: "Good", color: "text-slate-300", symbol: "" },
  inaccuracy: { label: "Inaccuracy", color: "text-yellow-400", symbol: "?!" },
  mistake: { label: "Mistake", color: "text-orange-400", symbol: "?" },
  blunder: { label: "Blunder", color: "text-red-400", symbol: "??" },
};

export const RESULT_STYLE: Record<Result, string> = {
  win: "bg-emerald-500/20 text-emerald-300",
  loss: "bg-red-500/20 text-red-300",
  draw: "bg-slate-500/20 text-slate-300",
};

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
      className={`relative w-4 shrink-0 overflow-hidden rounded bg-slate-800 ${flipped ? "" : "rotate-180"}`}
      title={formatEval(cp)}
    >
      <div className="absolute inset-x-0 top-0 bg-slate-100 transition-all" style={{ height: `${white}%` }} />
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}>{children}</div>;
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base = "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : "border border-slate-700 text-slate-200 hover:bg-slate-800";
  return (
    <button {...props} className={`${base} ${styles} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
