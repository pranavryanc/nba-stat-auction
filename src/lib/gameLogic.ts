import type { Player, TeamReport } from '../types';

export const grade = (score: number) =>
  score >= 90 ? 'A+' :
  score >= 85 ? 'A' :
  score >= 80 ? 'A-' :
  score >= 75 ? 'B+' :
  score >= 70 ? 'B' :
  score >= 65 ? 'B-' :
  score >= 60 ? 'C+' :
  score >= 55 ? 'C' :
  score >= 50 ? 'C-' :
  score >= 45 ? 'D+' :
  score >= 40 ? 'D' :
  'F';

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);

export type PlayoffFinish =
  | 'NBA Champion'
  | 'Finals Loss'
  | 'Conference Finals'
  | 'Second Round'
  | 'First Round'
  | 'Play-In'
  | 'Missed Playoffs';

export function projectPlayoffFinish(
  wins: number,
  overall: number,
  netRating: number,
  offense: number,
  defense: number,
  fit: number,
): PlayoffFinish {
  const playoffStrength =
    overall * 0.28 +
    offense * 0.17 +
    defense * 0.25 +
    fit * 0.15 +
    clamp(50 + netRating * 4) * 0.15;

  // Middle-ground postseason model:
  // deep runs require a legitimately strong regular season and playoff profile,
  // while second-round appearances remain attainable for good teams.
  if (
    wins >= 57 &&
    playoffStrength >= 86 &&
    defense >= 76 &&
    netRating >= 6
  ) return 'NBA Champion';

  if (
    wins >= 54 &&
    playoffStrength >= 82 &&
    defense >= 72 &&
    netRating >= 4.5
  ) return 'Finals Loss';

  if (
    wins >= 51 &&
    playoffStrength >= 77 &&
    netRating >= 3
  ) return 'Conference Finals';

  if (
    wins >= 47 &&
    playoffStrength >= 70
  ) return 'Second Round';

  if (
    wins >= 42 &&
    playoffStrength >= 61
  ) return 'First Round';

  if (wins >= 37) return 'Play-In';
  return 'Missed Playoffs';
}

export function analyzeTeam(team: Player[]): TeamReport {
  const avgPoints = average(team.map(p => p.points));
  const avgAssistPct = average(team.map(p => p.assistPercentage));
  const avgReboundPct = average(team.map(p => p.reboundPercentage));
  const avgTrueShooting = average(team.map(p => p.trueShooting));
  const avgDefensiveRating = average(team.map(p => p.defensiveRating));
  const avgThreePointPct = average(team.map(p => p.threePointPercentage));
  const avgStocksPct = average(team.map(p => p.stealPercentage + p.blockPercentage));

  const scoring = clamp(60 + (avgPoints - 18) * 4);
  const efficiency = clamp(55 + (avgTrueShooting - 55) * 4);

  const creatorCount = team.filter(p => p.assistPercentage >= 25).length;
  const eliteCreatorCount = team.filter(p => p.assistPercentage >= 35).length;
  const playmaking = clamp(50 + (avgAssistPct - 15) * 2.3 + creatorCount * 3 + eliteCreatorCount * 2);

  const rebounding = clamp(55 + (avgReboundPct - 10) * 5);

  const goodShooters = team.filter(p => p.threePointPercentage >= 37).length;
  const eliteShooters = team.filter(p => p.threePointPercentage >= 40).length;
  const nonShooters = team.filter(p => p.threePointPercentage < 30).length;
  const spacing = clamp(
    55 +
    (avgThreePointPct - 33) * 3.2 +
    goodShooters * 3 +
    eliteShooters * 2 -
    Math.max(0, nonShooters - 1) * 5,
  );

  const defense = clamp(
    70 +
    (114 - avgDefensiveRating) * 2.4 +
    (avgStocksPct - 3) * 3,
  );

  const assignedRoster = rosterAssignment(team);
  const guards = assignedRoster.guards.length;
  const forwards = assignedRoster.forwards.length;
  const centers = assignedRoster.centers.length;

  const balance = clamp(
    100 -
    Math.abs(guards - 2) * 20 -
    Math.abs(forwards - 2) * 20 -
    Math.abs(centers - 1) * 28,
  );

  const size = clamp(
    55 +
    assignedRoster.forwards.length * 4 +
    assignedRoster.centers.length * 8 +
    (avgReboundPct - 10) * 2,
  );

  const usageRates = team.map(p => p.usageRate);
  const usageSpread = Math.max(...usageRates) - Math.min(...usageRates);
  const highUsage = team.filter(p => p.usageRate >= 29).length;
  const extremeUsage = team.filter(p => p.usageRate >= 34).length;

  let usagePenalty = 0;
  if (highUsage > 2) usagePenalty += (highUsage - 2) * 4;
  if (extremeUsage > 2) usagePenalty += (extremeUsage - 2) * 3;
  if (usageSpread < 5) usagePenalty += 4;

  let fit = 72;
  fit += (balance - 80) * 0.35;

  if (goodShooters >= 3) fit += 6;
  else if (goodShooters >= 2) fit += 3;
  else fit -= 6;

  if (creatorCount >= 2) fit += 5;
  else if (creatorCount === 0) fit -= 8;

  if (size >= 70) fit += 4;
  if (size < 55) fit -= 5;
  if (defense >= 80) fit += 4;
  if (defense < 60) fit -= 5;

  fit -= usagePenalty;
  fit = clamp(fit);

  const offense = clamp(
    scoring * 0.45 +
    efficiency * 0.35 +
    spacing * 0.10 +
    playmaking * 0.10 -
    usagePenalty * 0.25,
  );

  const defenseCategory = clamp(
    defense * 0.78 +
    rebounding * 0.14 +
    size * 0.08,
  );

  const overall = Math.round(
    clamp(
      offense * 0.30 +
      defenseCategory * 0.25 +
      playmaking * 0.125 +
      rebounding * 0.10 +
      spacing * 0.10 +
      fit * 0.125,
    ),
  );

  const offensiveRating = Math.round((104 + offense * 0.18) * 10) / 10;
  const defensiveRating = Math.round((121 - defenseCategory * 0.17) * 10) / 10;
  const netRating = Math.round((offensiveRating - defensiveRating) * 10) / 10;

  const pythagoreanExponent = 14;
  const offensePower = Math.pow(offensiveRating, pythagoreanExponent);
  const defensePower = Math.pow(defensiveRating, pythagoreanExponent);
  const expectedWinPct = offensePower / (offensePower + defensePower);

  // Pull extreme Pythagorean records toward .500 so 55+ wins are harder to earn.
  const rawProjectedWins = expectedWinPct * 82;
  const baseProjectedWins = 41 + (rawProjectedWins - 41) * 0.85;

  const starPlayers = team.filter(
    p => p.boxPlusMinus >= 5 || p.estimatedPlusMinus >= 5 || p.playerEfficiencyRating >= 22,
  ).length;

  const superstarPlayers = team.filter(
    p => p.boxPlusMinus >= 8 || p.estimatedPlusMinus >= 8 || p.playerEfficiencyRating >= 27,
  ).length;

  // Star power helps, but cannot inflate a record by itself.
  const starPowerAdjustment = Math.min(
    1.5,
    starPlayers * 0.35 + superstarPlayers * 0.30,
  );

  const individualImpactScores = team.map(p =>
    p.boxPlusMinus * 0.45 +
    p.estimatedPlusMinus * 0.35 +
    (p.playerEfficiencyRating - 15) * 0.20,
  );

  const weakestPlayerImpact = Math.min(...individualImpactScores);

  // Weak starters hurt more than excellent fifth starters help.
  let weakLinkAdjustment = 0;
  if (weakestPlayerImpact >= 3) weakLinkAdjustment = 0.75;
  else if (weakestPlayerImpact >= 1) weakLinkAdjustment = 0.25;
  else if (weakestPlayerImpact < -4) weakLinkAdjustment = -4;
  else if (weakestPlayerImpact < -2) weakLinkAdjustment = -2.5;
  else if (weakestPlayerImpact < 0) weakLinkAdjustment = -1.25;

  // Fit has modest upside but meaningful downside when construction is poor.
  let fitAdjustment = 0;
  if (fit >= 85) fitAdjustment = 1.25;
  else if (fit >= 75) fitAdjustment = 0.5;
  else if (fit < 50) fitAdjustment = -4;
  else if (fit < 60) fitAdjustment = -2.5;
  else if (fit < 70) fitAdjustment = -1;

  const twoWayGap = Math.abs(offense - defenseCategory);
  let twoWayAdjustment = 0;

  if (offense >= 82 && defenseCategory >= 82) twoWayAdjustment = 1;
  else if (offense < 55 && defenseCategory < 55) twoWayAdjustment = -5;
  else if (offense < 60 && defenseCategory < 60) twoWayAdjustment = -3;
  else if (twoWayGap >= 25) twoWayAdjustment = -2;
  else if (twoWayGap >= 18) twoWayAdjustment = -1;

  // Serious roster flaws should be visible in the final record.
  let rosterFlawAdjustment = 0;
  if (goodShooters < 2) rosterFlawAdjustment -= 1.5;
  if (creatorCount === 0) rosterFlawAdjustment -= 2;
  if (defenseCategory < 50) rosterFlawAdjustment -= 2.5;
  if (rebounding < 45) rosterFlawAdjustment -= 1.5;

  const projectedWins = Math.round(
    clamp(
      baseProjectedWins +
      starPowerAdjustment +
      weakLinkAdjustment +
      fitAdjustment +
      twoWayAdjustment +
      rosterFlawAdjustment,
      9,
      73,
    ),
  );

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  const cats = {
    Offense: offense,
    Defense: defenseCategory,
    Playmaking: playmaking,
    Rebounding: rebounding,
    Spacing: spacing,
    'Team Fit': fit,
  };

  Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .forEach(([category]) => strengths.push(`${category} projects as a major advantage.`));

  Object.entries(cats)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .forEach(([category]) => weaknesses.push(`${category} is the clearest area to improve.`));

  if (highUsage >= 4) weaknesses.push('Too many high-usage creators may reduce offensive balance.');
  if (goodShooters < 2) weaknesses.push('Limited high-level shooting could compress the floor.');
  if (creatorCount < 2) weaknesses.push('The lineup may lack enough secondary shot creation.');
  if (defenseCategory >= 88) strengths.push('The lineup has championship-level defensive indicators.');
  if (goodShooters >= 4) strengths.push('Elite shooting depth should create excellent floor spacing.');
  if (creatorCount >= 3) strengths.push('Multiple capable creators give the offense strong playmaking versatility.');

  return {
    overall,
    grade: grade(overall),
    projectedWins,
    offensiveRating,
    defensiveRating,
    netRating,
    categories: Object.fromEntries(Object.entries(cats).map(([key, value]) => [key, Math.round(value)])),
    strengths,
    weaknesses,
  };
}

export const eligibility = (player: Player) => player.eligiblePositions?.length ? player.eligiblePositions : [player.position];
export const canPlayGuard = (player: Player) => eligibility(player).includes('G');
export const canPlayForward = (player: Player) => eligibility(player).includes('F');
export const canPlayCenter = (player: Player) => eligibility(player).includes('C');
export const positionText = (player: Player) => player.detailedPositions?.length ? player.detailedPositions.join('/') : eligibility(player).join('/');
export const positionBreakdownText = (player: Player) => {
  if (!player.positionPercentages) return positionText(player);
  const order = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
  const breakdown = order.map(position => `${position} ${player.positionPercentages?.[position] ?? 0}%`).join(' · ');
  return `${breakdown} · 25% eligibility threshold · maximum two positions`;
};

type RosterSlot = 'G1' | 'G2' | 'F1' | 'F2' | 'C';
const ROSTER_SLOTS: RosterSlot[] = ['G1', 'G2', 'F1', 'F2', 'C'];
const canFillSlot = (player: Player, slot: RosterSlot) =>
  slot.startsWith('G') ? canPlayGuard(player) : slot.startsWith('F') ? canPlayForward(player) : canPlayCenter(player);

export function findRosterAssignment(team: Player[]) {
  if (team.length > 5) return null;
  const ordered = [...team].sort((a, b) => {
    const aOptions = ROSTER_SLOTS.filter(slot => canFillSlot(a, slot)).length;
    const bOptions = ROSTER_SLOTS.filter(slot => canFillSlot(b, slot)).length;
    return aOptions - bOptions;
  });
  const assigned = new Map<RosterSlot, Player>();
  const search = (index: number): boolean => {
    if (index === ordered.length) return true;
    const player = ordered[index];
    for (const slot of ROSTER_SLOTS) {
      if (assigned.has(slot) || !canFillSlot(player, slot)) continue;
      assigned.set(slot, player);
      if (search(index + 1)) return true;
      assigned.delete(slot);
    }
    return false;
  };
  return search(0) ? assigned : null;
}

export function rosterAssignment(team: Player[]) {
  const assignment = findRosterAssignment(team);
  if (!assignment) return { guards: [] as Player[], forwards: [] as Player[], centers: [] as Player[] };
  return {
    guards: [...assignment.entries()].filter(([slot]) => slot.startsWith('G')).map(([, player]) => player),
    forwards: [...assignment.entries()].filter(([slot]) => slot.startsWith('F')).map(([, player]) => player),
    centers: [...assignment.entries()].filter(([slot]) => slot === 'C').map(([, player]) => player),
  };
}

export function canStillBuildValidRoster(team: Player[]) {
  return team.length <= 5 && findRosterAssignment(team) !== null;
}

export function isValidRoster(team: Player[]) {
  return team.length === 5 && findRosterAssignment(team) !== null;
}

export const lineupKey = (team: Player[]) => team.map(player => String(player.id)).sort().join('|');
export const sameLineup = (a: Player[], b: Player[]) => lineupKey(a) === lineupKey(b);
const individualValue = (player: Player) =>
  player.points * 1.8 + player.assists * 1.5 + player.rebounds * 1.15 + player.steals * 2.2 + player.blocks * 2.0
  + player.trueShooting * .22 + player.boxPlusMinus * 2.4 + player.estimatedPlusMinus * 2.2
  - player.price * .12;

export function findIdealLineup(pool: Player[], budget: number) {
  type State = { team: Player[]; spent: number; nextIndex: number; heuristic: number };
  let beam: State[] = [{ team: [], spent: 0, nextIndex: 0, heuristic: 0 }];
  const beamWidth = 7000;
  for (let depth = 0; depth < 5; depth += 1) {
    const next: State[] = [];
    for (const state of beam) {
      for (let index = state.nextIndex; index < pool.length; index += 1) {
        const player = pool[index];
        if (state.spent + player.price > budget) continue;
        if (state.team.some(member => member.name === player.name)) continue;
        const team = [...state.team, player];
        if (!canStillBuildValidRoster(team)) continue;
        next.push({ team, spent: state.spent + player.price, nextIndex: index + 1, heuristic: state.heuristic + individualValue(player) });
      }
    }
    next.sort((a, b) => b.heuristic - a.heuristic);
    beam = next.slice(0, beamWidth);
  }
  const finalists = beam.filter(state => isValidRoster(state.team));
  if (!finalists.length) return [];
  finalists.sort((a, b) => {
    const reportA = analyzeTeam(a.team);
    const reportB = analyzeTeam(b.team);
    return reportB.overall - reportA.overall || reportB.netRating - reportA.netRating || b.spent - a.spent;
  });
  return finalists[0].team;
}
