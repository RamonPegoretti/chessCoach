import type { Profile } from "./profile";
import type { Motif } from "./types";

export interface Tip {
  id: string;
  title: string;
  /** Why this tip is for you, from your own numbers. */
  evidence: string;
  advice: string[];
  /** Higher = more urgent. */
  severity: number;
}

const pct = (x: number) => `${Math.round(x)}%`;

const MOTIF_TIPS: Record<Exclude<Motif, "positional">, { title: string; advice: string[]; weight: number; what: string }> = {
  "hung-piece": {
    title: "Stop leaving pieces undefended",
    what: "left a piece hanging",
    weight: 3,
    advice: [
      "Before every move, do a blunder check: after my move, which of my pieces are attacked and not defended?",
      "Pay extra attention to the piece that just moved and the pieces it used to protect.",
      "Practice with your own puzzles below: they are positions where this happened.",
    ],
  },
  "lost-material": {
    title: "Watch for attacks by cheaper pieces",
    what: "let a valuable piece get taken by a cheaper one",
    weight: 2.5,
    advice: [
      "A defended piece is still in danger if a pawn or minor piece can take it.",
      "Count attackers and defenders, and compare piece values, before leaving a piece on a square.",
    ],
  },
  "allowed-fork": {
    title: "Spot your opponent's forks",
    what: "walked into a fork",
    weight: 2.5,
    advice: [
      "Knights fork most often: look at every square an enemy knight can reach next move.",
      "Pieces on the same colour as an enemy bishop, or on the same line as a queen, can be forked.",
      "Avoid putting your king and queen a knight's jump apart.",
    ],
  },
  "allowed-attack": {
    title: "Check your opponent's threats first",
    what: "missed a threat your opponent created",
    weight: 2,
    advice: [
      "Each move, start by asking: what does my opponent want to do now? Look at checks, captures, and attacks.",
      "If you can't see the point of your opponent's last move, slow down until you do.",
    ],
  },
  "allowed-mate": {
    title: "Keep your king safe",
    what: "allowed a forced mate",
    weight: 4,
    advice: [
      "Give your king an escape square (a 'luft' pawn move) to avoid back-rank mates.",
      "Don't open the pawns in front of your castled king without a reason.",
      "When your opponent has a queen near your king, list every check they have before you move.",
    ],
  },
  "missed-capture": {
    title: "Take the free material",
    what: "missed a chance to win material",
    weight: 2,
    advice: [
      "Every move, look at all the captures you have, even ones that look silly.",
      "Ask: is any enemy piece undefended or defended fewer times than I attack it?",
    ],
  },
  "missed-fork": {
    title: "Look for double attacks",
    what: "missed a fork",
    weight: 1.5,
    advice: [
      "When two enemy pieces stand undefended, look for a square that attacks both.",
      "Checks that also attack another piece are the most common winning forks.",
    ],
  },
  "missed-mate": {
    title: "Finish the game when you can",
    what: "missed a forced mate",
    weight: 3,
    advice: [
      "When the enemy king is exposed, check every check first: checks, captures, then threats.",
      "Practise mate-in-2 puzzles to train the common patterns.",
    ],
  },
};

const PHASE_ADVICE = {
  opening: [
    "Pick one opening as White and one defence for each of 1.e4 and 1.d4, and stick with them.",
    "Follow the basics: control the centre, develop knights and bishops, and castle early.",
    "After each game, look up where you left the main line.",
  ],
  middlegame: [
    "Before each move, check for tactics: checks, captures, threats, for both sides.",
    "Make a simple plan: improve your worst piece, or attack where you have more pawns.",
  ],
  endgame: [
    "Learn the key basics: king and pawn endings, the opposition, and rook endings (Lucena and Philidor).",
    "In the endgame, your king is a strong piece. Bring it to the centre.",
    "When you are ahead, trade pieces, not pawns.",
  ],
};

export function buildTips(p: Profile): Tip[] {
  const tips: Tip[] = [];

  if (p.analysed >= 3) {
    for (const m of p.motifs) {
      if (m.motif === "positional") continue;
      const t = MOTIF_TIPS[m.motif];
      if (m.count < 2) continue;
      tips.push({
        id: `motif-${m.motif}`,
        title: t.title,
        evidence: `You ${t.what} ${m.count} times in ${p.analysed} reviewed games (${m.perGame} per game).`,
        advice: t.advice,
        severity: m.perGame * t.weight * 10,
      });
    }

    const phases = Object.entries(p.accuracyByPhase) as [keyof typeof PHASE_ADVICE, number][];
    if (phases.length >= 2) {
      const sorted = [...phases].sort((a, b) => a[1] - b[1]);
      const [worst, worstAcc] = sorted[0];
      const bestAcc = sorted[sorted.length - 1][1];
      if (bestAcc - worstAcc >= 4) {
        tips.push({
          id: `phase-${worst}`,
          title: `Your ${worst} is your weakest phase`,
          evidence: `Your accuracy is ${worstAcc} in the ${worst}, compared with ${bestAcc} in your best phase.`,
          advice: PHASE_ADVICE[worst],
          severity: (bestAcc - worstAcc) * 1.5,
        });
      }
    }

    if (p.timeTrouble && p.timeTrouble.lowRate >= p.timeTrouble.normalRate * 1.5) {
      tips.push({
        id: "time-trouble",
        title: "You crack under time pressure",
        evidence: `With under 30 seconds left, ${pct(p.timeTrouble.lowRate * 100)} of your moves are mistakes, compared with ${pct(p.timeTrouble.normalRate * 100)} otherwise.`,
        advice: [
          "Spend less time in the opening: play the moves you know quickly.",
          "Keep at least a third of your time for the second half of the game.",
          "Try games with increment (like 3+2 or 10+5) so time trouble hurts less.",
        ],
        severity: (p.timeTrouble.lowRate / Math.max(0.01, p.timeTrouble.normalRate)) * 6,
      });
    }

    if (p.thrownWins.of >= 4 && p.thrownWins.count / p.thrownWins.of >= 0.25) {
      tips.push({
        id: "conversion",
        title: "Convert your winning positions",
        evidence: `You had a winning position in ${p.thrownWins.of} games but won only ${p.thrownWins.of - p.thrownWins.count} of them.`,
        advice: [
          "When you are winning, play safe: remove your opponent's threats before going for more.",
          "Trade pieces when you're ahead in material.",
          "Don't relax. Most turnarounds come from one careless move after the hard part is done.",
        ],
        severity: (p.thrownWins.count / p.thrownWins.of) * 30,
      });
    }
  }

  // These need no engine analysis.
  const overall = p.total.score;
  for (const o of p.openings.slice(0, 15)) {
    if (o.games >= 8 && o.score <= overall - 12 && o.name !== "Unknown opening") {
      tips.push({
        id: `opening-${o.color}-${o.name}`,
        title: `Rethink the ${o.name} as ${o.color === "w" ? "White" : "Black"}`,
        evidence: `You score ${o.score}% in ${o.games} games with it, compared with ${overall}% overall.`,
        advice: [
          "Review a few of these games and find the move where things went wrong.",
          "Learn the main ideas and the first 6 to 8 moves, or switch to a line you score better with.",
        ],
        severity: (overall - o.score) * Math.min(1, o.games / 20),
      });
    }
  }
  const { w, b } = p.byColor;
  if (w.games >= 20 && b.games >= 20 && Math.abs(w.score - b.score) >= 12) {
    const weak = w.score < b.score ? "Black" : "White";
    tips.push({
      id: "color-gap",
      title: `You struggle more as ${weak}`,
      evidence: `You score ${w.score}% as White and ${b.score}% as Black.`,
      advice: [
        `Spend your opening study time on your ${weak} repertoire first.`,
        weak === "Black"
          ? "As Black, aim for solid, simple setups first and equalize before attacking."
          : "As White, use the first-move advantage: grab the centre and develop fast.",
      ],
      severity: Math.abs(w.score - b.score) * 0.8,
    });
  }

  return tips.sort((a, b) => b.severity - a.severity).slice(0, 5);
}
