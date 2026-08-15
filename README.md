# NBA Stat Auction

A polished, responsive React + TypeScript roster-building game. Players receive a randomized 80-player pool and must draft exactly 2 guards, 2 forwards, and 1 center without exceeding the chosen salary cap. Secondary positions can satisfy any eligible slot.

## Included

- Classic, Daily Challenge, and Unlimited modes
- Easy ($175), Normal ($150), and Hard ($125) difficulties
- Search, team/position/price filters, and sorting
- Animated player selection and budget updates
- Responsive desktop/mobile roster panel
- Position and salary-cap validation
- Post-submit evaluation model with overall rating, record projection, offensive/defensive/net ratings, category grades, strengths, and weaknesses
- Local lineup saving and clipboard sharing
- Statistics page with advanced metrics
- JSON player dataset
- NBA CDN image URLs with graceful fallbacks

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Data note

The included player JSON is a development/demo dataset shaped exactly for the requested 2025–26 schema. Before public release, replace or verify the statistical values against a licensed, authoritative 2025–26 regular-season data source. Player images and logos load from NBA CDN URLs and include fallback UI when an image is unavailable.


## Refresh the 2025–26 player database

Run `npm run update-data` to download the completed 2025–26 regular-season player statistics from the NBA Stats endpoints and rebuild `src/data/players.json`. The updater includes every player who appeared in at least one regular-season game, including low-minute reserves.

Pool selection is a uniform seeded shuffle. There are no guaranteed stars, no protected tiers, and no minimum number of high-price players.


## Refreshing player data

Current-season data and prices:

```bash
npm run update-data
```

Historic Mode data (all available regular seasons from 1946-47 through 2025-26):

```bash
npm run update-history
```

Historic data is downloaded once and stored locally in `src/data/historicalPlayers.json`. A historic entry represents one player in one specific season. The same player may therefore appear more than once in a 100-player pool if different seasons are randomly selected. Traditional steals and blocks are zero in seasons before the NBA officially tracked those categories.

Auction price formula: `round(PTS + REB + AST + STL + BLK)`.


## Multi-position roster eligibility

Every player can have one or more eligible positions (`G`, `F`, `C`). The lineup must be assignable as exactly two guards, two forwards, and one center. Hybrid players such as `G/F` or `F/C` are assigned dynamically to whichever eligible slot makes the lineup valid. The data update scripts estimate season-specific secondary positions from that season's statistical role when an authoritative position feed is unavailable.

## Position eligibility

The data updaters use Basketball-Reference's season play-by-play positional-minute estimates when available. A player receives eligibility at every five-man position where the estimate is at least **25%** of his minutes:

- PG and SG map to the game's Guard group.
- SF and PF map to Forward eligibility.
- C maps to Center eligibility.
- A player above the threshold in both groups can fill either type of roster slot.
- If no estimated position reaches 25%, the position with the largest share is retained.
- Seasons or players without a matching estimate retain the statistical fallback so the database update never fails solely because position data is missing.

The updater stores `detailedPositions`, `positionPercentages`, and `positionSource` in the JSON. Basketball-Reference percentages are downloaded only by the updater; the browser never scrapes or contacts Basketball-Reference, so gameplay performance is unchanged.

Run:

```bash
npm run update-data
npm run update-history
```

Historical updates deliberately pause between Basketball-Reference season requests. You can set `BREF_POSITION_START_YEAR` to change the first season for which the updater attempts position estimates.

## Updated lineup and replay rules

- Players have one primary position and at most one secondary position.
- A secondary position is granted only when Basketball-Reference estimates at least 25% of minutes there.
- If several secondary positions reach 25%, only the highest-percentage secondary position is retained.
- Classic and Historic results reveal the model-optimal lineup and require a new pool to play again.
- Unlimited allows repeated attempts with the same pool until the player succeeds or gives up.
- Daily Challenge keeps its fixed daily pool and cannot be reset.

## Daily Challenge behavior

Daily Challenge uses the player's local calendar date as a deterministic seed. The same date always produces the same 80-player pool from the same dataset. While the app remains open, a one-second clock detects local midnight, clears the prior attempt, and automatically loads the next day's pool. Daily pools cannot be manually reset.

## Native-style mobile flow

On phone-sized screens the app now opens on a dedicated game-mode home screen. During a draft, a persistent bottom navigation provides Home, Players, Search, and Lineup destinations. Search and lineup controls open as touch-friendly bottom sheets, and team analysis uses a full-screen scrollable results view. Desktop behavior remains unchanged.

## Google login, records, and Daily leaderboard

This version uses Supabase for authentication and score storage.

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/schema.sql`.
3. In Supabase Authentication > Providers, enable Google and add your Google OAuth Client ID and Client Secret.
4. In Supabase Authentication > URL Configuration, add your local and production URLs (for example `http://localhost:5173` and your Vercel domain) as redirect URLs.
5. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase Project Settings > API.
6. Run `npm install` and `npm run dev`.

The application database stores email as its only personal user field. Supabase Auth itself necessarily maintains authentication/session identifiers and provider metadata. Public Daily leaderboard queries return an anonymous player label rather than the email address.
