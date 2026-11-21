# Chess Coach

A free, browser-based chess coach. Import every game from your Lichess or Chess.com account (or paste a PGN), let Stockfish review them, and get personalized tips based on the mistakes you actually make.

Everything runs in your browser: no account, no API key, no server costs. Your games are stored in your browser (IndexedDB).

## What it does

- **Your chess story**: a swipeable, Wrapped-style recap: your signature first move, a 0-100 coach score with tiers (Pawn to King), your style on seven axes, the chess legend you play like (Tal, Fischer, Capablanca, Karpov, Kasparov, Carlsen, Petrosian, Morphy, Nakamura), your boldest move, your costliest mistake and your best and worst openings. Ends with a share image (`src/lib/story.ts`, `src/components/StoryView.tsx`).
- **Course**: one chapter per weakness, each with a short lesson, a checklist, where the habit shows up in your games, and puzzles from your own positions. Progress is saved in the browser (`src/lib/course.ts`).
- **Demo**: "See a demo story" loads `public/demo-games.json`, 40 pre-reviewed games. Rebuild it with `npx tsx scripts/make-demo.mts [games] [depth]`.

- **Import**: the full history of a Lichess account (one streamed export) or a Chess.com account (every monthly archive). Syncing again only fetches new games.
- **Engine review**: Stockfish 19 (lite, WASM, single-threaded) reviews games in the background, newest first. Each of your moves gets an accuracy score and a label (inaccuracy, mistake, blunder).
- **Explanations without AI**: mistakes are explained with rule-based pattern checks (`src/lib/motifs.ts`): hung pieces, losing material to a cheaper piece, forks, missed captures, missed or allowed mates, and missed threats.
- **Coach**: your profile (accuracy by phase, why you lose material, openings, rating, time trouble, thrown wins) picks your top weaknesses and shows matching tips (`src/lib/tips.ts`).
- **Train**: puzzles made from your own blunders.

## Development

```bash
npm install        # also copies the Stockfish engine into public/engine
npm run dev
```

Then open http://localhost:3000.

Analyze a PGN from the terminal with the same code the app uses:

```bash
npm run analyze-pgn -- game.pgn w 12   # file, your colour (w|b), depth
```

## Deploying on Vercel

Import the repo in Vercel and keep the defaults (framework: Next.js). No environment variables are needed.
