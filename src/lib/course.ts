import { winChance } from "./analysis";
import type { Profile } from "./profile";
import { buildTips, type Tip } from "./tips";
import type { ReviewedMove, StoredGame } from "./types";

export interface Puzzle {
  id: string;
  game: StoredGame;
  move: ReviewedMove;
}

export interface Lesson {
  /** Short explanation of the idea. */
  concept: string[];
  /** What to ask yourself during a game. */
  checklist: string[];
}

export interface Module {
  id: string;
  title: string;
  evidence: string;
  lesson: Lesson;
  puzzles: Puzzle[];
  /** Puzzles to solve on the first try to finish the module. */
  goal: number;
}

export type Outcome = "first" | "retry" | "shown";

export interface Progress {
  puzzles: Record<string, Outcome>;
  lessons: Record<string, boolean>;
}

const KEY = "chess-coach-progress";

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { puzzles: {}, lessons: {}, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  return { puzzles: {}, lessons: {} };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

/** Every mistake or blunder with a concrete better move, newest first. */
export function allPuzzles(games: StoredGame[]): Puzzle[] {
  return games
    .filter((g) => g.analysis)
    .sort((a, b) => b.playedAt - a.playedAt)
    .flatMap((g) =>
      g
        .analysis!.moves.filter(
          (m) => (m.cls === "blunder" || m.cls === "mistake") && m.bestUci && m.motif !== "positional",
        )
        .map((m) => ({ id: `${g.id}:${m.ply}`, game: g, move: m })),
    );
}

const LESSONS: Record<string, Lesson> = {
  "motif-hung-piece": {
    concept: [
      "Most games below master level are decided by a piece left en prise: attacked and not defended.",
      "It usually happens with the piece that just moved, or with a piece that the moving piece was guarding.",
    ],
    checklist: [
      "Which of my pieces are attacked after this move?",
      "Did the piece I'm moving defend something?",
      "Is every piece defended at least as many times as it is attacked?",
    ],
  },
  "motif-lost-material": {
    concept: [
      "Defended doesn't mean safe. If a pawn can take your knight, it doesn't matter that your knight is protected.",
      "Always compare the value of the attacker with the value of the target.",
    ],
    checklist: ["Can a cheaper piece attack this square?", "After the trade, who is ahead?"],
  },
  "motif-allowed-fork": {
    concept: [
      "A fork is one piece attacking two targets. Knights are the most common forkers because their jump is hard to see.",
      "The best defence is to never place two valuable pieces where one enemy piece can hit both.",
    ],
    checklist: [
      "Where can enemy knights jump next move?",
      "Are my king and queen on the same line or a knight's jump apart?",
    ],
  },
  "motif-allowed-attack": {
    concept: [
      "Every move your opponent makes has a purpose. When you skip asking what it is, you walk into threats.",
      "Strong players start every move by looking at the position from the other side of the board.",
    ],
    checklist: ["What does my opponent's last move attack?", "What would they play if it were their move again?"],
  },
  "motif-allowed-mate": {
    concept: [
      "King safety beats material. A missing escape square or an open file near your king can end the game instantly.",
      "Back-rank mates and queen-plus-piece attacks are the patterns that catch most players.",
    ],
    checklist: [
      "Does my king have an escape square?",
      "List every check my opponent has. Do any of them lead to mate?",
    ],
  },
  "motif-missed-capture": {
    concept: [
      "Free material is everywhere when you start looking for it. Opponents blunder too, and you need to collect.",
      "Scan captures even when they look impossible; sometimes the defender is overloaded or pinned.",
    ],
    checklist: ["Which enemy pieces are undefended?", "What happens if I take everything I can take?"],
  },
  "motif-missed-fork": {
    concept: [
      "Double attacks win material because your opponent can only answer one threat at a time.",
      "Look for loose pieces first: undefended pieces are the targets for forks.",
    ],
    checklist: ["Are two enemy pieces undefended?", "Is there a check that also attacks something?"],
  },
  "motif-missed-mate": {
    concept: [
      "When the enemy king is exposed, checks come first. Forcing moves leave your opponent no time to defend.",
      "Most missed mates are two-movers: a sacrifice that opens the king, then the finishing blow.",
    ],
    checklist: ["What are all my checks?", "If I give up material, can my opponent survive?"],
  },
  "phase-opening": {
    concept: [
      "You don't need to memorise theory. You need a small repertoire and to understand its plans.",
      "Centre, development, castling: when you break these early, you start the middlegame worse off.",
    ],
    checklist: ["Have I developed a new piece this move?", "Can I castle in the next two moves?"],
  },
  "phase-middlegame": {
    concept: [
      "The middlegame is where tactics live. Checks, captures and threats, for both sides, every move.",
      "When there are no tactics, improve your worst-placed piece.",
    ],
    checklist: ["Checks, captures, threats: mine and theirs?", "Which of my pieces does nothing?"],
  },
  "phase-endgame": {
    concept: [
      "In the endgame the king becomes an attacking piece, and pawns turn into queens.",
      "A few patterns, like the opposition, the Lucena and the Philidor, cover most endgames you will play.",
    ],
    checklist: ["Is my king active?", "Which pawn can become a passed pawn?"],
  },
  "time-trouble": {
    concept: [
      "Your accuracy collapses when the clock runs low. The fix is budgeting time, not playing faster.",
      "Solving these positions quickly trains you to see the right move without long thinking.",
    ],
    checklist: ["Am I using my time where the position is critical?", "Do I still have a third of my time at move 20?"],
  },
  conversion: {
    concept: [
      "Winning a won position is a separate skill. Most turnarounds come from one careless move.",
      "When ahead: kill counterplay, trade pieces, and don't hurry.",
    ],
    checklist: ["What is my opponent's only chance?", "Can I trade a pair of pieces?"],
  },
  "color-gap": {
    concept: [
      "One colour scores much worse for you. Usually that means one half of your repertoire leads to positions you don't understand.",
    ],
    checklist: ["Do I know the plan after the opening?", "Am I playing for a position I like?"],
  },
  opening: {
    concept: [
      "This opening scores badly for you. Learn the first 6 to 8 moves and the typical plans, or swap it for something simpler.",
    ],
    checklist: ["Where did I leave the main line?", "What does the middlegame plan look like?"],
  },
  fundamentals: {
    concept: [
      "Before advanced strategy, cut out the big mistakes. A simple blunder check before every move removes most of them.",
    ],
    checklist: ["Checks, captures, threats?", "Is the piece I'm moving safe on its new square?"],
  },
};

function matcher(tip: Tip): (p: Puzzle) => boolean {
  const id = tip.id;
  if (id.startsWith("motif-")) {
    const motif = id.slice(6);
    return (p) => p.move.motif === motif;
  }
  if (id.startsWith("phase-")) {
    const phase = id.slice(6);
    return (p) => p.move.phase === phase;
  }
  if (id === "time-trouble") return (p) => p.move.clock !== undefined && p.move.clock < 30;
  if (id === "conversion") {
    return (p) => {
      const sign = p.game.userColor === "w" ? 1 : -1;
      return winChance(sign * (p.game.analysis!.evals[p.move.ply] ?? 0)) >= 70;
    };
  }
  if (id === "color-gap") {
    const weak = tip.title.includes("Black") ? "b" : "w";
    return (p) => p.game.userColor === weak;
  }
  if (id.startsWith("opening-")) {
    const [, color, ...rest] = id.split("-");
    const name = rest.join("-");
    return (p) => p.game.userColor === color && p.game.opening.startsWith(name);
  }
  return () => true;
}

export function buildCourse(games: StoredGame[], profile: Profile): Module[] {
  const puzzles = allPuzzles(games);
  const tips = buildTips(profile);
  const modules: Module[] = tips.map((t) => {
    const ps = puzzles.filter(matcher(t));
    const lessonKey = t.id.startsWith("opening-") ? "opening" : t.id;
    return {
      id: t.id,
      title: t.title,
      evidence: t.evidence,
      lesson: LESSONS[lessonKey] ?? LESSONS.fundamentals,
      puzzles: ps,
      goal: Math.min(8, Math.max(3, Math.ceil(ps.length * 0.6))),
    };
  });
  // Always end with the general blunder-check module so there's something to practise.
  if (puzzles.length && modules.length < 3) {
    modules.push({
      id: "fundamentals",
      title: "Blunder-check fundamentals",
      evidence: `${puzzles.length} positions from your games where a better move was available.`,
      lesson: LESSONS.fundamentals,
      puzzles,
      goal: Math.min(10, Math.max(3, Math.ceil(puzzles.length * 0.4))),
    });
  }
  // Tips carry their own advice: fold it into the checklist so nothing is lost.
  for (const m of modules) {
    const tip = tips.find((t) => t.id === m.id);
    if (tip) m.lesson = { concept: m.lesson.concept, checklist: [...m.lesson.checklist, ...tip.advice] };
  }
  return modules;
}

export function moduleProgress(m: Module, p: Progress) {
  const solved = m.puzzles.filter((z) => p.puzzles[z.id] === "first").length;
  const attempted = m.puzzles.filter((z) => p.puzzles[z.id]).length;
  const lesson = !!p.lessons[m.id];
  const done = lesson && solved >= Math.min(m.goal, m.puzzles.length);
  // Lesson counts for 20%, puzzles for the rest.
  const pct = Math.round((lesson ? 20 : 0) + (m.puzzles.length ? Math.min(1, solved / m.goal) * 80 : lesson ? 80 : 0));
  return { solved, attempted, lesson, done, pct };
}
