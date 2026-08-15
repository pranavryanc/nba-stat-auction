import type { GameMode, Player, TeamReport } from '../types';
import { supabase } from './supabase';

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
  lineup: Array<{ id: string | number; name: string; season?: string; positions: string; price: number }>;
  achieved_at: string;
};

const lineupSnapshot = (lineup: Player[]) => lineup.map(player => ({
  id: player.id,
  name: player.name,
  season: player.season,
  positions: player.detailedPositions?.join('/') ?? player.eligiblePositions?.join('/') ?? player.position,
  price: player.price,
}));

export async function registerUserEmail(email: string) {
  if (!supabase) return;
  const { error } = await supabase.from('app_users').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) throw error;
}

export async function saveGameScore(args: {
  email: string;
  mode: GameMode;
  challengeDate: string;
  lineup: Player[];
  report: TeamReport;
  spent: number;
}) {
  if (!supabase) return;
  const payload = {
    email: args.email,
    score: args.report.overall,
    projected_wins: args.report.projectedWins,
    net_rating: args.report.netRating,
    spent: args.spent,
    lineup: lineupSnapshot(args.lineup),
  };

  const { error: highScoreError } = await supabase.rpc('upsert_mode_high_score', {
    p_email: args.email,
    p_mode: args.mode,
    p_score: payload.score,
    p_projected_wins: payload.projected_wins,
    p_net_rating: payload.net_rating,
    p_spent: payload.spent,
    p_lineup: payload.lineup,
  });
  if (highScoreError) throw highScoreError;

  if (args.mode === 'daily') {
    const { error: dailyError } = await supabase.rpc('upsert_daily_score', {
      p_email: args.email,
      p_challenge_date: args.challengeDate,
      p_score: payload.score,
      p_projected_wins: payload.projected_wins,
      p_net_rating: payload.net_rating,
      p_spent: payload.spent,
      p_lineup: payload.lineup,
    });
    if (dailyError) throw dailyError;
  }
}

export async function getMyHighScores(email: string): Promise<SavedHighScore[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('high_scores')
    .select('mode,score,projected_wins,net_rating,spent,achieved_at')
    .eq('email', email);
  if (error) throw error;
  return (data ?? []) as SavedHighScore[];
}

export async function getDailyLeaderboard(challengeDate: string): Promise<DailyLeaderboardEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_daily_leaderboard', {
    p_challenge_date: challengeDate,
    p_limit: 10,
  });
  if (error) throw error;
  return (data ?? []) as DailyLeaderboardEntry[];
}
