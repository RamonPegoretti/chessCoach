# Chess Coach

A free, browser-based chess coach. Import every game from your Lichess or Chess.com account (or paste a PGN), let Stockfish review them, and get personalized tips based on the mistakes you actually make.

Everything runs in your browser: no account, no API key, no server costs. Your games are stored in your browser (IndexedDB).

## What it does

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
