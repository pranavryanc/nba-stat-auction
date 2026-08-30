# NBA Stat Auction Backend Setup

NBA Stat Auction uses Supabase for authentication, player data, secure game sessions, score verification, profiles, and leaderboard storage.

## 1. Create Supabase

Create a Supabase project.

Apply the current SQL schema and migrations included in the `supabase/` directory.

For a brand-new deployment, start with the current `supabase/schema.sql` and then apply any later migrations required by the repository.

Do not restore or grant access to deprecated score-submission RPCs. Current gameplay uses secure game sessions and server-verified score submission.

## 2. Configure Google OAuth

In Google Auth Platform, create a **Web application** OAuth client.

Add the appropriate Authorized JavaScript origins, including:

- `http://localhost:5173`
- your production website origin

For Authorized redirect URIs, use the callback URL shown on the Supabase Google provider page. It normally follows this format:

`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

In **Supabase → Authentication → Providers → Google**:

1. Enable Google.
2. Add the Google Client ID.
3. Add the Google Client Secret.

In **Supabase → Authentication → URL Configuration**:

- Set the Site URL to the production website.
- Add `http://localhost:5173` as a local Redirect URL.
- Add the production URL as a Redirect URL.

## 3. Add environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Set:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Only use the public/anon or publishable browser key in the frontend.

Never expose the Supabase service-role secret in browser code, committed files, or public environment variables.

## 4. Install and run

```bash
npm install
npm run dev
```

## 5. Vercel

Add the same frontend environment variables in:

**Vercel → Project Settings → Environment Variables**

Then redeploy the application.

## Authentication and users

Google authentication is handled by Supabase Auth.

Application users choose a unique public username that can be displayed on leaderboards.

Email addresses are not exposed through the public Daily leaderboard.

Username rules are:

- 3–20 characters
- Letters, numbers, underscores, and periods only
- Unique case-insensitively

Supabase Auth separately maintains authentication/session identifiers and provider metadata required for authentication.

## Player data

Current and historical player-season data are stored in Supabase.

The frontend does not need the entire historical NBA dataset. Instead, the backend creates the official player pool for each game session and the application loads the corresponding player records.

Player-data migration and maintenance scripts are stored in `scripts/`.

## Secure game sessions

A game begins by creating a server-controlled game session.

The backend determines and stores information such as:

- Authenticated user
- Game mode
- Difficulty
- Official salary cap
- Official player pool
- Daily Challenge date when applicable
- Session expiration

Classic and Unlimited sessions use current-player pools.

Historic sessions use historical player-season records and prevent multiple seasons of the same named player from appearing in the same pool.

Daily Challenge sessions use the server-controlled Daily pool.

## Secure score submission

The browser is not trusted to calculate or submit the official score.

When the user analyzes a lineup, the client submits the game session ID and the selected player IDs.

Before accepting the result, the backend verifies:

- The authenticated user owns the session
- The session is valid and has not expired
- Exactly five players were submitted
- Every submitted player belongs to the official session pool
- Player IDs are unique
- Duplicate player identities are not used
- The lineup satisfies the salary cap
- The lineup can fill exactly 2 Guard, 2 Forward, and 1 Center slots
- Daily Challenge submissions belong to the correct server-controlled challenge date

After validation, the backend independently recalculates the official game result, including the score and related team metrics.

The client cannot provide a trusted score, projected-win total, net rating, or amount spent.

## Daily Challenge

The Daily Challenge date is controlled by the backend using the application's server-date rules rather than trusting the user's browser clock.

The Daily pool is deterministic for that challenge date.

Clients cannot request arbitrary Daily leaderboard dates to bypass the active challenge.

## Score storage

Score tables store the game result and associated information required by the application.

This can include:

- User reference
- Game mode
- Overall score
- Projected wins
- Net rating
- Amount spent
- Lineup snapshot
- Challenge date where applicable
- Creation/update timestamps

Score records are associated with application users through database relationships.

## Leaderboards and high scores

`high_scores` stores the user's best qualifying results by game mode.

`daily_scores` stores the user's Daily Challenge result for the appropriate challenge date.

Daily leaderboard ranking uses the verified backend result.

Public leaderboard responses use the player's username and do not expose email addresses.

## Existing deployments

Older deployments may require migrations that were added after the initial schema.

For example, deployments created before usernames were introduced may require:

`supabase/username-migration.sql`

Security migrations added later in development must also be applied to older databases.

When updating an existing deployment, review the SQL files in `supabase/` before assuming that rerunning only the original schema is sufficient.

## Local validation

Before deploying backend-related frontend changes, run:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run test:e2e
```

GitHub Actions also runs the core validation suite automatically for pushes and pull requests.
