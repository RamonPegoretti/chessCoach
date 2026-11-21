import type { Motif } from "./types";

export const MOTIF_LABEL: Record<Motif, { label: string; hint: string }> = {
  "hung-piece": { label: "Hung a piece", hint: "one of your pieces is about to be lost. Save it." },
  "lost-material": { label: "Lost material to a cheaper piece", hint: "watch what the cheaper enemy pieces attack." },
  "missed-capture": { label: "Missed winning material", hint: "something can be taken for free." },
  "missed-fork": { label: "Missed a fork", hint: "one piece can attack two targets." },
  "allowed-fork": { label: "Walked into a fork", hint: "where can the enemy fork you next move?" },
  "allowed-attack": { label: "Missed the opponent's threat", hint: "what is your opponent threatening?" },
  "missed-mate": { label: "Missed a mate", hint: "start with checks." },
  "allowed-mate": { label: "Allowed a mate", hint: "your king is in danger." },
  positional: { label: "Positional / strategic", hint: "improve your worst piece." },
};
