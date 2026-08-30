import { describe, expect, it } from 'vitest';
import type { Player, Position } from '../types';
import {
  analyzeTeam,
  findIdealLineup,
  isValidRoster,
  sameLineup,
} from './gameLogic';

const player = (
  id: string,
  name: string,
  position: Position,
  overrides: Partial<Player> = {},
): Player => ({
  id,
  name,
  team: 'Test Team',
  teamAbbreviation: 'TST',
  position,
  eligiblePositions: [position],
  photo: '',
  teamLogo: '',
  points: 20,
  rebounds: 8,
  assists: 5,
  steals: 1.5,
  blocks: 0.8,
  price: 25,
  threePointPercentage: 36,
  trueShooting: 58,
  offensiveRating: 115,
  defensiveRating: 111,
  usageRate: 22,
  assistPercentage: 20,
  reboundPercentage: 10,
  stealPercentage: 1.5,
  blockPercentage: 1.2,
  playerEfficiencyRating: 20,
  winShares: 5,
  boxPlusMinus: 3,
  estimatedPlusMinus: 3,
  ...overrides,
});

const balancedTeam = [
  player('g1', 'Guard One', 'G', {
    points: 28, assists: 8, rebounds: 4, price: 30,
    threePointPercentage: 39, trueShooting: 61,
    defensiveRating: 110, usageRate: 28, assistPercentage: 30,
    reboundPercentage: 8, stealPercentage: 2, blockPercentage: 1,
    playerEfficiencyRating: 23, boxPlusMinus: 5, estimatedPlusMinus: 4,
  }),
  player('g2', 'Guard Two', 'G', {
    points: 22, assists: 7, rebounds: 4, price: 27,
    threePointPercentage: 38, trueShooting: 59,
    defensiveRating: 112, usageRate: 24, assistPercentage: 27,
    reboundPercentage: 7, stealPercentage: 1.7, blockPercentage: 0.5,
    playerEfficiencyRating: 20, boxPlusMinus: 3, estimatedPlusMinus: 3,
  }),
  player('f1', 'Forward One', 'F', {
    points: 20, assists: 4, rebounds: 8, price: 25,
    threePointPercentage: 37, trueShooting: 58,
    defensiveRating: 108, usageRate: 22, assistPercentage: 18,
    reboundPercentage: 12, stealPercentage: 1.5, blockPercentage: 1.2,
    playerEfficiencyRating: 21, boxPlusMinus: 4, estimatedPlusMinus: 4,
  }),
  player('f2', 'Forward Two', 'F', {
    points: 18, assists: 3, rebounds: 9, price: 24,
    threePointPercentage: 40, trueShooting: 60,
    defensiveRating: 107, usageRate: 20, assistPercentage: 15,
    reboundPercentage: 14, stealPercentage: 1.4, blockPercentage: 1.5,
    playerEfficiencyRating: 21, boxPlusMinus: 4, estimatedPlusMinus: 4,
  }),
  player('c1', 'Center One', 'C', {
    points: 16, assists: 2, rebounds: 12, price: 23,
    threePointPercentage: 34, trueShooting: 62,
    defensiveRating: 105, usageRate: 18, assistPercentage: 10,
    reboundPercentage: 18, stealPercentage: 1.2, blockPercentage: 3,
    playerEfficiencyRating: 24, boxPlusMinus: 5, estimatedPlusMinus: 5,
  }),
];

describe('roster validation', () => {
  it('accepts a 2G / 2F / 1C lineup', () => {
    expect(isValidRoster(balancedTeam)).toBe(true);
  });

  it('rejects a five-player lineup that cannot fill the required slots', () => {
    const badTeam = [
      player('g1', 'G1', 'G'),
      player('g2', 'G2', 'G'),
      player('g3', 'G3', 'G'),
      player('f1', 'F1', 'F'),
      player('c1', 'C1', 'C'),
    ];
    expect(isValidRoster(badTeam)).toBe(false);
  });

  it('uses flexible eligibility when a player can cover multiple groups', () => {
    const flexible = [
      player('g1', 'G1', 'G'),
      player('gf', 'GF', 'G', { eligiblePositions: ['G', 'F'] }),
      player('f1', 'F1', 'F'),
      player('f2', 'F2', 'F'),
      player('c1', 'C1', 'C'),
    ];
    expect(isValidRoster(flexible)).toBe(true);
  });
});

describe('team analysis', () => {
  it('preserves the current rating calculation for a known lineup', () => {
    const report = analyzeTeam(balancedTeam);

    expect(report.overall).toBe(77);
    expect(report.projectedWins).toBe(63);
    expect(report.offensiveRating).toBe(117.2);
    expect(report.defensiveRating).toBe(107.4);
    expect(report.netRating).toBe(9.8);
    expect(report.grade).toBe('B+');
  });

  it('keeps category ratings inside the 0-100 range', () => {
    const report = analyzeTeam(balancedTeam);
    for (const value of Object.values(report.categories)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});

describe('ideal lineup search', () => {
  it('never returns a lineup above the budget', () => {
    const pool = [
      ...balancedTeam,
      player('starG', 'Expensive Guard', 'G', {
        price: 80,
        points: 40,
        trueShooting: 70,
        boxPlusMinus: 12,
        estimatedPlusMinus: 12,
        playerEfficiencyRating: 32,
      }),
    ];

    const budget = 130;
    const lineup = findIdealLineup(pool, budget);

    expect(lineup).toHaveLength(5);
    expect(lineup.reduce((sum, p) => sum + p.price, 0)).toBeLessThanOrEqual(budget);
    expect(isValidRoster(lineup)).toBe(true);
  });

  it('does not use two seasons of the same named player', () => {
    const duplicateSeason = player('g1-old', 'Guard One', 'G', {
      season: '2024-25',
      price: 10,
      points: 50,
      trueShooting: 75,
    });

    const lineup = findIdealLineup([...balancedTeam, duplicateSeason], 150);
    const names = lineup.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('lineup identity', () => {
  it('treats the same five player IDs as the same lineup regardless of order', () => {
    expect(sameLineup(balancedTeam, [...balancedTeam].reverse())).toBe(true);
  });
});
