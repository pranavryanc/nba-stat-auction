import type { Player } from '../types';
import { supabase } from './supabase';

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

export async function getCurrentPlayers(): Promise<Player[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('player_seasons')
    .select('*')
    .eq('is_current', true)
    .order('original_player_id', { ascending: true });

  if (error) throw new Error(`Current players could not be loaded: ${error.message}`);
  if (!data || data.length < 80) throw new Error('The current player database is incomplete.');

  return (data as PlayerSeasonRow[]).map(rowToPlayer);
}

export async function getHistoricPlayerPool(size = 100): Promise<Player[]> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_random_historic_players', {
    p_limit: size,
  });

  if (error) throw new Error(`Historic players could not be loaded: ${error.message}`);
  if (!data || data.length < size) throw new Error('The historic player database is incomplete.');

  return (data as PlayerSeasonRow[]).map(rowToPlayer);
}
