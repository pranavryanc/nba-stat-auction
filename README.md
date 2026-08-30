# NBA Stat Auction

NBA Stat Auction is a responsive NBA roster-building game built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

Players receive a randomized pool of NBA players and must construct a five-player roster while staying under a salary cap. After submitting a valid lineup, the game evaluates the team using player statistics and produces an overall rating, projected record, advanced ratings, strengths, weaknesses, and other results.

## Game modes

### Classic

Build the best possible five-player roster from a randomized pool of 80 current NBA players.

Choose a difficulty:

- Easy — $175 budget
- Normal — $150 budget
- Hard — $125 budget

After submitting a lineup, the game evaluates the roster and compares it with the model's best lineup from the same pool.

### Daily Challenge

Every player receives the same server-controlled Daily Challenge pool for the day.

The Daily Challenge:

- Uses a $150 budget
- Uses a deterministic daily player pool
- Uses the server's America/New_York date rather than the browser clock
- Cannot be manually rerolled
- Automatically changes when the next Daily Challenge begins
- Supports a Daily leaderboard
- Verifies submitted scores on the backend

### Unlimited

Unlimited mode allows repeated attempts with the same player pool.

Players can continue experimenting with combinations until they find the ideal lineup or choose to start over.

### Historic

Historic mode builds a 100-player pool using NBA player-seasons from historical seasons.

Each entry represents a player during a specific NBA season. Historic pools prevent multiple seasons of the same named player from appearing in the same pool.

Historical data is stored in Supabase rather than being shipped to the browser as a large local JSON dataset.

## Roster rules

Every submitted team must contain exactly five players and be assignable to:

- 2 Guards
- 2 Forwards
- 1 Center

Players may have a primary position and at most one eligible secondary position.

Secondary positions are based on season-specific positional information and must satisfy the game's eligibility rules. Hybrid players can fill whichever eligible roster slot produces a valid lineup.

The backend independently verifies roster validity before accepting a score.

## Player prices

Auction prices are calculated using:

`round(PTS + REB + AST + STL + BLK)`

The server independently verifies the total lineup cost when a score is submitted.

## Team evaluation

Submitted teams receive a detailed evaluation that includes:

- Overall team rating
- Letter grade
- Projected regular-season wins
- Projected playoff finish
- Offensive rating
- Defensive rating
- Net rating
- Category ratings
- Team strengths
- Team weaknesses

The scoring model is implemented in shared game logic and covered by automated regression tests.

## Secure game sessions

Gameplay uses server-created game sessions.

When a game begins, the backend determines and stores the official:

- Game mode
- Difficulty
- Salary cap
- Player pool
- Challenge date when applicable
- Session expiration

The browser does not submit a trusted score.

When a lineup is analyzed, the browser sends the game session ID and selected player IDs. The backend then verifies:

- The authenticated user owns the session
- The session has not expired
- All submitted players belong to the official pool
- Player IDs are unique
- Duplicate player identities are not used
- The salary cap is satisfied
- The roster can fill exactly 2G / 2F / 1C
- The Daily Challenge date is valid

The backend then recalculates the official score, ratings, projected wins, and amount spent before storing the result.

## Authentication and profiles

NBA Stat Auction uses Supabase Authentication with Google sign-in.

Users choose a public username used on the Daily leaderboard.

Authentication and score data are stored through Supabase. Leaderboard results expose usernames rather than player email addresses.

## Player data

Current and historical NBA player-season data are stored in Supabase.

The application loads only the player records required for the active server-created game session instead of shipping the complete historical dataset to every browser.

Data maintenance scripts are available in `scripts/`.

Useful commands include:

```bash
npm run update-data
npm run update-history
npm run sanitize-positions
npm run audit-positions
```

## Position eligibility

Primary positions come from season-specific position data when available.

Basketball-Reference positional-minute estimates can be used by the data maintenance scripts to determine secondary-position eligibility.

The position system follows these general rules:

- Every player has a primary position.
- A player can receive at most one secondary position.
- A secondary position must meet the required positional-minute threshold.
- Secondary positions must satisfy the game's adjacency rules.
- Missing position estimates fall back safely rather than preventing data updates.

The browser does not scrape Basketball-Reference during gameplay.

## Saved lineups

Lineups can be saved locally in the browser and restored later when they are still compatible with the active game session and player pool.

The loader also supports upgrading older saved-lineup data when possible and rejects invalid or corrupted saves safely.

## Mobile experience

NBA Stat Auction includes a mobile-specific game flow.

On smaller screens, players receive:

- Mobile navigation
- Player browsing
- Search and filter controls
- Lineup bottom sheets
- Responsive roster management
- Full-screen team results

Desktop and mobile behavior are both covered by Playwright browser tests.

## Technology

The project uses:

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- Vitest
- Playwright
- ESLint
- Prettier
- GitHub Actions

## Local development

Install dependencies:

```bash
npm install
```

Create the required Supabase environment configuration using `.env.example`.

Then start the development server:

```bash
npm run dev
```

Open the local URL displayed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Automated testing

Run unit tests:

```bash
npm test
```

Run ESLint:

```bash
npm run lint
```

Check formatting:

```bash
npm run format:check
```

Run Playwright end-to-end tests:

```bash
npm run test:e2e
```

Format the codebase:

```bash
npm run format
```

## Continuous integration

GitHub Actions automatically validates pushes to `main` and pull requests targeting `main`.

CI checks:

1. Prettier formatting
2. ESLint
3. Vitest unit tests
4. Production build
5. Playwright end-to-end tests

This provides an automated safety check before changes are incorporated into the production codebase.

## Supabase setup

For a new deployment:

1. Create a Supabase project.
2. Apply the SQL schema and migrations in the project.
3. Enable Google authentication in Supabase.
4. Configure the appropriate local and production redirect URLs.
5. Copy `.env.example` to `.env`.
6. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. Install dependencies.
8. Start the application.

See `BACKEND_SETUP.md` for additional backend setup information.

## Development safety checks

Before pushing significant changes, run:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run test:e2e
```

The same core checks are also enforced by GitHub Actions.
