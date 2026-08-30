import type { Player } from '../types';

export const E2E_TEST_MODE = import.meta.env.VITE_E2E_TEST_MODE === 'true';
export const E2E_TEST_EMAIL = 'playwright@example.test';
export const E2E_TEST_USERNAME = 'PlaywrightGM';
export const E2E_SESSION_ID = '00000000-0000-4000-8000-000000000001';
export const E2E_DAILY_DATE = '2026-08-29';
export const E2E_RESETS_AT = '2099-01-01T05:00:00.000Z';

const makePlayer = (
  id: string,
  name: string,
  position: Player['position'],
  detailedPosition: NonNullable<Player['detailedPositions']>[number],
  price: number,
  overrides: Partial<Player> = {},
): Player => ({
  id,
  name,
  team: 'Playwright Testers',
  teamAbbreviation: 'PWT',
  position,
  eligiblePositions: [position],
  detailedPositions: [detailedPosition],
  primaryDetailedPosition: detailedPosition,
  listedDetailedPosition: detailedPosition,
  positionSource: 'listed-position',
  photo: '',
  teamLogo: '',
  points: 18,
  rebounds: 6,
  assists: 5,
  steals: 1.4,
  blocks: 0.7,
  season: '2025-26',
  price,
  threePointPercentage: 37,
  trueShooting: 59,
  offensiveRating: 116,
  defensiveRating: 110,
  usageRate: 22,
  assistPercentage: 20,
  reboundPercentage: 10,
  stealPercentage: 1.7,
  blockPercentage: 1.2,
  playerEfficiencyRating: 20,
  winShares: 6,
  boxPlusMinus: 3,
  estimatedPlusMinus: 3,
  ...overrides,
});

export const E2E_PLAYERS: Player[] = [
  makePlayer('e2e-g1', 'Test Guard Alpha', 'G', 'PG', 20, {
    points: 28, assists: 9, threePointPercentage: 40, trueShooting: 62,
    assistPercentage: 34, boxPlusMinus: 6, estimatedPlusMinus: 6,
  }),
  makePlayer('e2e-g2', 'Test Guard Beta', 'G', 'SG', 21, {
    points: 23, assists: 7, threePointPercentage: 39, trueShooting: 60,
    assistPercentage: 28, boxPlusMinus: 4, estimatedPlusMinus: 4,
  }),
  makePlayer('e2e-f1', 'Test Forward Alpha', 'F', 'SF', 22, {
    points: 21, rebounds: 8, threePointPercentage: 38, defensiveRating: 108,
    reboundPercentage: 13, boxPlusMinus: 4, estimatedPlusMinus: 4,
  }),
  makePlayer('e2e-f2', 'Test Forward Beta', 'F', 'PF', 23, {
    points: 19, rebounds: 10, threePointPercentage: 37, defensiveRating: 107,
    reboundPercentage: 15, blockPercentage: 2, boxPlusMinus: 4,
  }),
  makePlayer('e2e-c1', 'Test Center Alpha', 'C', 'C', 24, {
    points: 17, rebounds: 13, assists: 3, threePointPercentage: 34,
    trueShooting: 63, defensiveRating: 105, reboundPercentage: 19,
    blockPercentage: 4, playerEfficiencyRating: 24, boxPlusMinus: 5,
    estimatedPlusMinus: 5,
  }),
  makePlayer('e2e-g3', 'Test Guard Gamma', 'G', 'PG', 32),
  makePlayer('e2e-f3', 'Test Forward Gamma', 'F', 'SF', 31),
  makePlayer('e2e-c2', 'Test Center Beta', 'C', 'C', 30),
  makePlayer('e2e-gx', 'Test Expensive Guard', 'G', 'SG', 80, {
    points: 40, trueShooting: 70, boxPlusMinus: 10, estimatedPlusMinus: 10,
  }),
  makePlayer('e2e-flex', 'Test Flexible Wing', 'G', 'SG', 25, {
    eligiblePositions: ['G', 'F'],
    detailedPositions: ['SG', 'SF'],
  }),
];

export const E2E_DAILY_LEADERBOARD = [{
  player_label: 'TestLeader',
  score: 88,
  projected_wins: 61,
  net_rating: 8.4,
  spent: 145,
  lineup: E2E_PLAYERS.slice(0, 5).map(player => ({
    id: player.id,
    name: player.name,
    season: player.season,
    positions: player.detailedPositions?.join('/') ?? player.position,
    price: player.price,
  })),
  achieved_at: '2026-08-29T12:00:00.000Z',
}];
