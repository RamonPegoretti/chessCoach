"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStore } from "./store";
import { Button, Card } from "./ui";

/** Puzzles built from your own blunders: find the move you missed. */
export function TrainPanel() {
  const { games } = useStore();
  const puzzles = useMemo(
    () =>
      games
        .filter((g) => g.analysis)
        .sort((a, b) => b.playedAt - a.playedAt)
        .flatMap((g) =>
          g.analysis!.moves
            .filter((m) => (m.cls === "blunder" || m.cls === "mistake") && m.bestUci && m.motif !== "positional")
            .map((m) => ({ game: g, move: m })),
        ),
    [games],
  );
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<"solving" | "wrong" | "solved" | "shown">("solving");
  const [fen, setFen] = useState<string | null>(null);

  if (!puzzles.length) {
    return (
      <Card>
        No puzzles yet. Once some of your games are reviewed, the positions where you went wrong show up here so you
        can practise them.
      </Card>
    );
  }

  const { game, move } = puzzles[index % puzzles.length];
  const position = fen ?? move.fenBefore;
  const toMove = move.fenBefore.split(" ")[1] === "w" ? "white" : "black";

  const next = () => {
    setIndex((i) => i + 1);
    setStatus("solving");
    setFen(null);
  };

  const onDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    if (!targetSquare || status === "solved" || status === "shown") return false;
    const chess = new Chess(move.fenBefore);
    let played;
    try {
      played = chess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    } catch {
      return false;
    }
    const uci = played.from + played.to + (played.promotion ?? "");
    if (uci === move.bestUci || (move.bestUci.length === 4 && uci.slice(0, 4) === move.bestUci)) {
      setFen(chess.fen());
      setStatus("solved");
      return true;
    }
    setStatus("wrong");
    return false;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,520px)_1fr]">
      <Chessboard
        options={{
          position,
          boardOrientation: toMove,
          onPieceDrop: onDrop,
          darkSquareStyle: { backgroundColor: "#4b7399" },
          lightSquareStyle: { backgroundColor: "#eae9d2" },
          arrows:
            status === "shown"
              ? [{ startSquare: move.bestUci.slice(0, 2), endSquare: move.bestUci.slice(2, 4), color: "rgba(16,185,129,0.8)" }]
              : [],
        }}
      />
      <Card className="flex flex-col gap-3 text-sm">
        <div className="text-xs text-slate-400">
          Puzzle {(index % puzzles.length) + 1} of {puzzles.length} · from your game vs{" "}
          {game.userColor === "w" ? game.black : game.white}, {new Date(game.playedAt).toLocaleDateString()}
        </div>
        <p className="text-base">
          {toMove === "white" ? "White" : "Black"} to move. In the game you played{" "}
          <span className="font-semibold text-red-400">{move.san}</span>. Find the better move.
        </p>
        {status === "wrong" && <p className="text-orange-400">Not that one. Try again.</p>}
        {status === "solved" && (
          <p className="text-emerald-400">
            Correct, {move.bestSan}! {move.explanation}
          </p>
        )}
        {status === "shown" && (
          <p className="text-slate-300">
            The move was <span className="font-semibold text-emerald-400">{move.bestSan}</span>. {move.explanation}
          </p>
        )}
        <div className="flex gap-2">
          {status !== "solved" && status !== "shown" && (
            <Button variant="ghost" onClick={() => setStatus("shown")}>
              Show answer
            </Button>
          )}
          <Button onClick={next}>Next puzzle</Button>
        </div>
      </Card>
    </div>
  );
}
