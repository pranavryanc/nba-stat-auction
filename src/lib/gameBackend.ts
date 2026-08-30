import type { Difficulty, GameMode, Player } from '../types';
import { supabase } from './supabase';
import { analyzeTeam } from './gameLogic';
import { E2E_DAILY_DATE, E2E_DAILY_LEADERBOARD, E2E_PLAYERS, E2E_RESETS_AT, E2E_SESSION_ID, E2E_TEST_MODE, E2E_TEST_USERNAME } from './e2eFixtures';

export type SavedHighScore = {
  mode: GameMode;
  score: number;
  projected_wins: number;
  net_rating: number;
  spent: number;
  achieved_at: string;
};

export type DailyLeaderboardEntry = {
  player_label: string;
  score: number;
  projected_wins: number;
  net_rating: number;
  spent: number;
  lineup: Array<{
    id: string | number;
    name: string;
    season?: string;
    positions: string;
    price: number;
  }>;
  achieved_at: string;
};

export type SecureGameSession = {
  sessionId: string;
  budget: number;
  challengeDate: string | null;
  resetsAt: string;
  players: Player[];
};

export type VerifiedScore = {
  score: number;
  projected_wins: number;
  net_rating: number;
  spent: number;
  challenge_date: string | null;
};

type PlayerSeasonRow = {
  id: string;
  original_player_id: number;
  name: string;
  season: string;
  team_name: string | null;
  team_abbreviation: string;
  position: string;
  eligible_positions: string[];
  detailed_positions: string[] | null;
  primary_detailed_position: string | null;
  listed_detailed_position: string | null;
  position_percentages: Player['positionPercentages'] | null;
  position_source: string;
  photo: string | null;
  team_logo: string | null;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  price: number;
  three_point_percentage: number;
  true_shooting: number;
  offensive_rating: number;
  defensive_rating: number;
  usage_rate: number;
  assist_percentage: number;
  rebound_percentage: number;
  steal_percentage: number;
  block_percentage: number;
  player_efficiency_rating: number;
  win_shares: number;
  box_plus_minus: number;
  estimated_plus_minus: number;
};

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function rowToPlayer(row: PlayerSeasonRow): Player {
  return {
    id: row.id,
    originalPlayerId: row.original_player_id,
    name: row.name,
    team: row.team_name ?? row.team_abbreviation,
    teamAbbreviation: row.team_abbreviation,
    position: row.position,
    eligiblePositions: row.eligible_positions,
    detailedPositions: row.detailed_positions ?? undefined,
    primaryDetailedPosition: row.primary_detailed_position ?? undefined,
    listedDetailedPosition: row.listed_detailed_position ?? undefined,
    positionPercentages: row.position_percentages ?? undefined,
    positionSource: row.position_source,
    season: row.season,
    photo: row.photo ?? '',
    teamLogo: row.team_logo ?? '',
    points: row.points,
    rebounds: row.rebounds,
    assists: row.assists,
    steals: row.steals,
    blocks: row.blocks,
    price: row.price,
    threePointPercentage: row.three_point_percentage,
    trueShooting: row.true_shooting,
    offensiveRating: row.offensive_rating,
    defensiveRating: row.defensive_rating,
    usageRate: row.usage_rate,
    assistPercentage: row.assist_percentage,
    reboundPercentage: row.rebound_percentage,
    stealPercentage: row.steal_percentage,
    blockPercentage: row.block_percentage,
    playerEfficiencyRating: row.player_efficiency_rating,
    winShares: row.win_shares,
    boxPlusMinus: row.box_plus_minus,
    estimatedPlusMinus: row.estimated_plus_minus,
  } as Player;
}

export async function registerUserEmail(email: string) {
  if (E2E_TEST_MODE) return;
  const client = requireSupabase();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) throw new Error('You must be signed in.');

  const { error } = await client
    .from('app_users')
    .upsert(
      { email, user_id: user.id },
      { onConflict: 'email', ignoreDuplicates: false },
    );

  if (error) throw error;
}

export async function getMyUsername(email: string): Promise<string | null> {
  if (E2E_TEST_MODE) return E2E_TEST_USERNAME;
  const client = requireSupabase();
  const { data, error } = await client
    .from('app_users')
    .select('username')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data?.username ?? null;
}

export async function setMyUsername(
  email: string,
  username: string,
): Promise<string> {
  if (E2E_TEST_MODE) return username.trim();
  const client = requireSupabase();
  const cleaned = username.trim();

  if (!/^[A-Za-z0-9_.]{3,20}$/.test(cleaned)) {
    throw new Error(
      'Username must be 3-20 characters and use only letters, numbers, underscores, or periods.',
    );
  }

  const { data, error } = await client.rpc('set_my_username', {
    p_email: email,
    p_username: cleaned,
  });

  if (error) throw error;
  return String(data ?? cleaned);
}

export async function createGameSession(
  mode: GameMode,
  difficulty: Difficulty,
): Promise<SecureGameSession> {
  if (E2E_TEST_MODE) {
    const budget = mode === 'daily'
      ? 150
      : difficulty === 'easy'
        ? 175
        : difficulty === 'hard'
          ? 125
          : 150;
    return {
      sessionId: E2E_SESSION_ID,
      budget,
      challengeDate: mode === 'daily' ? E2E_DAILY_DATE : null,
      resetsAt: E2E_RESETS_AT,
      players: E2E_PLAYERS,
    };
  }
  const client = requireSupabase();

  const { data, error } = await client.rpc('create_game_session_secure', {
    p_mode: mode,
    p_difficulty: difficulty,
  });

  if (error) throw new Error(`Game session could not be created: ${error.message}`);

  const session = Array.isArray(data) ? data[0] : data;
  if (!session?.session_id || !Array.isArray(session.pool_ids)) {
    throw new Error('The server returned an invalid game session.');
  }

  const { data: rows, error: playerError } = await client
    .from('player_seasons')
    .select('*')
    .in('id', session.pool_ids);

  if (playerError) {
    throw new Error(`Game-session players could not be loaded: ${playerError.message}`);
  }

  const byId = new Map(
    ((rows ?? []) as PlayerSeasonRow[]).map(row => [row.id, rowToPlayer(row)]),
  );

  const players = (session.pool_ids as string[])
    .map((id: string) => byId.get(id))
    .filter((player: Player | undefined): player is Player => Boolean(player));

  if (players.length !== session.pool_ids.length) {
    throw new Error('One or more players from the server session could not be loaded.');
  }

  return {
    sessionId: String(session.session_id),
    budget: Number(session.budget),
    challengeDate: session.challenge_date ?? null,
    resetsAt: String(session.resets_at),
    players,
  };
}

export async function saveGameScore(args: {
  sessionId: string;
  lineup: Player[];
}): Promise<VerifiedScore> {
  if (E2E_TEST_MODE) {
    if (args.lineup.length !== 5) throw new Error('Exactly five players are required.');
    const report = analyzeTeam(args.lineup);
    return {
      score: report.overall,
      projected_wins: report.projectedWins,
      net_rating: report.netRating,
      spent: args.lineup.reduce((sum, player) => sum + player.price, 0),
      challenge_date: null,
    };
  }
  const client = requireSupabase();

  if (args.lineup.length !== 5) {
    throw new Error('Exactly five players are required.');
  }

  const { data, error } = await client.rpc('submit_game_score_secure', {
    p_session_id: args.sessionId,
    p_player_ids: args.lineup.map(player => String(player.id)),
  });

  if (error) throw new Error(`Score could not be verified: ${error.message}`);

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error('The server did not return a verified score.');

  return result as VerifiedScore;
}

export async function getMyHighScores(
  email: string,
): Promise<SavedHighScore[]> {
  if (E2E_TEST_MODE) return [];
  const client = requireSupabase();

  const { data, error } = await client
    .from('high_scores')
    .select('mode,score,projected_wins,net_rating,spent,achieved_at')
    .eq('email', email);

  if (error) throw error;
  return (data ?? []) as SavedHighScore[];
}

export async function getDailyLeaderboard(
  _challengeDate?: string,
): Promise<DailyLeaderboardEntry[]> {
  if (E2E_TEST_MODE) return E2E_DAILY_LEADERBOARD as DailyLeaderboardEntry[];
  const client = requireSupabase();

  const { data, error } = await client.rpc('get_daily_leaderboard_secure', {
    p_limit: 10,
  });

  if (error) throw error;
  return (data ?? []) as DailyLeaderboardEntry[];
}

export async function getServerClock(): Promise<{
  challengeDate: string;
  resetsAt: string;
}> {
  if (E2E_TEST_MODE) {
    return { challengeDate: E2E_DAILY_DATE, resetsAt: E2E_RESETS_AT };
  }
  const client = requireSupabase();

  const { data, error } = await client.rpc('get_nba_auction_clock');
  if (error) throw error;

  const clock = Array.isArray(data) ? data[0] : data;
  if (!clock?.challenge_date || !clock?.resets_at) {
    throw new Error('The server clock is unavailable.');
  }

  return {
    challengeDate: String(clock.challenge_date),
    resetsAt: String(clock.resets_at),
  };
}
