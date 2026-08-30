import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';

const DEFAULT_HISTORICAL_PATH = 'src/data/historicalPlayers.json';
const DEFAULT_CURRENT_PATH = 'src/data/players.json';
const BATCH_SIZE = 500;

function loadJson(filePath) {
  const absolutePath = path.resolve(filePath);
  const value = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

  if (!Array.isArray(value)) {
    throw new Error(`${absolutePath} must contain a JSON array.`);
  }

  return value;
}

function required(value, fieldName, player) {
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `Missing ${fieldName} for ${player.name ?? 'unknown player'} (${player.id ?? 'no id'}).`,
    );
  }

  return value;
}

function toRow(player, sourceFile, currentKeys) {
  const originalPlayerId = Number(player.originalPlayerId ?? player.id);
  const season = required(player.season, 'season', player);
  const id = `${season}-${originalPlayerId}`;
  const teamAbbreviation = required(player.teamAbbreviation, 'teamAbbreviation', player);

  if (!Number.isInteger(originalPlayerId)) {
    throw new Error(`Invalid player id for ${player.name ?? player.id}.`);
  }

  return {
    id,
    original_player_id: originalPlayerId,
    name: required(player.name, 'name', player),
    season,
    team_name:
      sourceFile === 'players.json' && player.team !== teamAbbreviation ? player.team : null,
    team_abbreviation: teamAbbreviation,
    position: required(player.position, 'position', player),
    eligible_positions: player.eligiblePositions ?? [],
    detailed_positions: player.detailedPositions ?? null,
    primary_detailed_position: player.primaryDetailedPosition ?? null,
    listed_detailed_position: player.listedDetailedPosition ?? null,
    position_percentages: player.positionPercentages ?? null,
    position_source: required(player.positionSource, 'positionSource', player),
    photo: player.photo ?? null,
    team_logo: player.teamLogo ?? null,
    points: required(player.points, 'points', player),
    rebounds: required(player.rebounds, 'rebounds', player),
    assists: required(player.assists, 'assists', player),
    steals: required(player.steals, 'steals', player),
    blocks: required(player.blocks, 'blocks', player),
    price: required(player.price, 'price', player),
    three_point_percentage: required(player.threePointPercentage, 'threePointPercentage', player),
    true_shooting: required(player.trueShooting, 'trueShooting', player),
    offensive_rating: required(player.offensiveRating, 'offensiveRating', player),
    defensive_rating: required(player.defensiveRating, 'defensiveRating', player),
    usage_rate: required(player.usageRate, 'usageRate', player),
    assist_percentage: required(player.assistPercentage, 'assistPercentage', player),
    rebound_percentage: required(player.reboundPercentage, 'reboundPercentage', player),
    steal_percentage: required(player.stealPercentage, 'stealPercentage', player),
    block_percentage: required(player.blockPercentage, 'blockPercentage', player),
    player_efficiency_rating: required(
      player.playerEfficiencyRating,
      'playerEfficiencyRating',
      player,
    ),
    win_shares: required(player.winShares, 'winShares', player),
    box_plus_minus: required(player.boxPlusMinus, 'boxPlusMinus', player),
    estimated_plus_minus: required(player.estimatedPlusMinus, 'estimatedPlusMinus', player),
    is_current: currentKeys.has(id),
    source_file: sourceFile,
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  const historicalPath = process.argv[2] ?? DEFAULT_HISTORICAL_PATH;
  const currentPath = process.argv[3] ?? DEFAULT_CURRENT_PATH;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.');
  }

  const historicalPlayers = loadJson(historicalPath);
  const currentPlayers = loadJson(currentPath);
  const currentKeys = new Set(
    currentPlayers.map((player) => `${player.season}-${Number(player.id)}`),
  );

  // Historical rows are loaded first. Current-file rows then replace matching
  // player-season records so players.json is authoritative for 2025-26.
  const rowsById = new Map();

  for (const player of historicalPlayers) {
    const row = toRow(player, 'historicalPlayers.json', currentKeys);
    rowsById.set(row.id, row);
  }

  for (const player of currentPlayers) {
    const row = toRow(player, 'players.json', currentKeys);
    rowsById.set(row.id, row);
  }

  const rows = [...rowsById.values()];

  if (rows.length !== rowsById.size) {
    throw new Error('Unexpected duplicate rows remained after normalization.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: resetError } = await supabase
    .from('player_seasons')
    .update({ is_current: false })
    .eq('is_current', true);

  if (resetError) {
    throw new Error(`Could not reset current-season flags: ${resetError.message}`);
  }

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const { error } = await supabase.from('player_seasons').upsert(batch, { onConflict: 'id' });

    if (error) {
      throw new Error(
        `Upload failed for rows ${start + 1}-${start + batch.length}: ${error.message}`,
      );
    }

    console.log(`Uploaded ${Math.min(start + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  console.log(
    `Migration complete: ${rows.length} player-seasons, ${currentKeys.size} current players.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
