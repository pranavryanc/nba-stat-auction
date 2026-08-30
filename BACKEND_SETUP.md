# NBA Stat Auction Backend Setup

## 1. Create Supabase

Create a Supabase project, then open **SQL Editor** and run the complete `supabase/schema.sql` file.

## 2. Configure Google OAuth

In Google Auth Platform, create a **Web application** OAuth client.

Add these Authorized JavaScript origins while developing:

- `http://localhost:5173`
- your deployed website origin, for example `https://nba-stat-auction.vercel.app`

For Authorized redirect URIs, use the callback URL shown on the Supabase Google provider page. It normally looks like:

- `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

In Supabase **Authentication → Providers → Google**, enable Google and paste the Google Client ID and Client Secret.

In Supabase **Authentication → URL Configuration**:

- Set **Site URL** to your production website.
- Add `http://localhost:5173` as a Redirect URL for local development.
- Add your production URL as a Redirect URL.

## 3. Add environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Use the public/anon or publishable browser key, never the service-role secret.

## 4. Install and run

```bash
npm install
npm run dev
```

## 5. Vercel

Add the same two environment variables in **Vercel → Project Settings → Environment Variables**, then redeploy.

## What is stored

The app tables use email as the only personal user field. Score tables additionally store game data: mode, score, projected wins, net rating, amount spent, lineup snapshot, challenge date where applicable, and timestamps. Google/Supabase Auth necessarily maintains authentication/session identifiers and provider metadata separately from the app tables.

## Scoring behavior

- `high_scores`: one best score per user per mode.
- `daily_scores`: one best score per user for each Daily Challenge date.
- Primary ranking: Overall Team Rating (0–100).
- Tie-break context: projected wins, net rating, then lower spend.
- Public Daily leaderboard shows an anonymous label (`Player ABC123`), never the email address.

## Username upgrade

If you already ran the original database schema before usernames were added, open the Supabase SQL Editor and run:

`supabase/username-migration.sql`

This adds a unique username to each application user and changes the Daily leaderboard to display usernames instead of anonymous generated labels. Existing accounts will be prompted to choose a username the next time they sign in.

Username rules:

- 3–20 characters
- letters, numbers, underscores, and periods only
- unique, case-insensitive
- the user's email remains private and is never returned by the Daily leaderboard function
