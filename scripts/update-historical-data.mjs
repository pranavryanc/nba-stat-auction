import { writeFile } from 'node:fs/promises';
import { fetchBasketballReferencePositions, findPositionRecord, POSITION_ELIGIBILITY_THRESHOLD } from './basketball-reference-positions.mjs';

const endpoint = 'https://stats.nba.com/stats/leaguedashplayerstats';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  Accept: 'application/json, text/plain, */*',
};

const commonParams = {
  College: '', Conference: '', Country: '', DateFrom: '', DateTo: '', Division: '', DraftPick: '', DraftYear: '',
  GameScope: '', GameSegment: '', Height: '', LastNGames: '0', LeagueID: '00', Location: '', Month: '0',
  OpponentTeamID: '0', Outcome: '', PORound: '0', PaceAdjust: 'N', PerMode: 'PerGame', Period: '0',
  PlayerExperience: '', PlayerPosition: '', PlusMinus: 'N', Rank: 'N', SeasonSegment: '', SeasonType: 'Regular Season',
  ShotClockRange: '', StarterBench: '', TeamID: '0', TwoWay: '0', VsConference: '', VsDivision: '', Weight: '',
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const round1 = value => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const inferPosition = p => n(p.REB) >= 8 || (n(p.BLK) >= 1.5 && n(p.AST) < 4) ? 'C' : n(p.AST) >= 4.5 ? 'G' : 'F';
const inferEligiblePositions = (_p, primary) => [primary];

function seasonLabel(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

async function getSeasonRows(season, attempt = 1) {
  const url = new URL(endpoint);
  Object.entries({ ...commonParams, MeasureType: 'Base', Season: season }).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const set = json.resultSets?.[0];
    if (!set) throw new Error('No result set returned');
    return set.rowSet.map(row => Object.fromEntries(set.headers.map((header, index) => [header, row[index]])));
  } catch (error) {
    if (attempt >= 3) throw error;
    console.warn(`  Retry ${attempt}/2 after request error…`);
    await sleep(1500 * attempt);
    return getSeasonRows(season, attempt + 1);
  }
}

function toPlayerSeason(p, season, positionMap) {
  const playerId = n(p.PLAYER_ID);
  const points = round1(n(p.PTS));
  const rebounds = round1(n(p.REB));
  const assists = round1(n(p.AST));
  const steals = round1(n(p.STL));
  const blocks = round1(n(p.BLK));
  const minutes = n(p.MIN);
  const fga = n(p.FGA);
  const fta = n(p.FTA);
  const trueShooting = fga + 0.44 * fta > 0 ? round1(points / (2 * (fga + 0.44 * fta)) * 100) : 0;
  const threePointPercentage = round1(n(p.FG3_PCT) * 100);
  const stealPercentage = round1(steals / Math.max(minutes, 1) * 48);
  const blockPercentage = round1(blocks / Math.max(minutes, 1) * 48);
  const usageProxy = clamp(15 + points * 0.42 + assists * 0.22, 8, 42);
  const impactProxy = clamp((points + rebounds * 0.7 + assists * 0.9 + steals * 1.8 + blocks * 1.6) / 4.2 - 5, -8, 14);
  const teamAbbreviation = p.TEAM_ABBREVIATION || 'NBA';
  const fallbackPosition = inferPosition(p);
  const positionRecord = findPositionRecord(positionMap, p.PLAYER_NAME, teamAbbreviation);
  const position = positionRecord?.position ?? fallbackPosition;
  return {
    id: `${season}-${playerId}`,
    originalPlayerId: playerId,
    name: p.PLAYER_NAME,
    team: teamAbbreviation,
    teamAbbreviation,
    position,
    eligiblePositions: positionRecord?.eligiblePositions ?? inferEligiblePositions(p, position),
    detailedPositions: positionRecord?.detailedPositions,
    primaryDetailedPosition: positionRecord?.primaryDetailedPosition,
    positionPercentages: positionRecord?.positionPercentages,
    positionSource: positionRecord?.positionSource ?? 'statistical-fallback',
    season,
    photo: `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`,
    teamLogo: `https://cdn.nba.com/logos/nba/${teamAbbreviation}/global/L/logo.svg`,
    points,
    rebounds,
    assists,
    steals,
    blocks,
    price: Math.round(points + rebounds + assists + steals + blocks),
    threePointPercentage,
    trueShooting,
    offensiveRating: round1(clamp(108 + impactProxy * 1.15, 88, 132)),
    defensiveRating: round1(clamp(113 - (steals * 1.6 + blocks * 1.4 + rebounds * 0.18), 92, 124)),
    usageRate: round1(usageProxy),
    assistPercentage: round1(clamp(assists * 4.2, 2, 55)),
    reboundPercentage: round1(clamp(rebounds * 1.45, 2, 30)),
    stealPercentage,
    blockPercentage,
    playerEfficiencyRating: round1(clamp(15 + impactProxy * 1.15, 3, 38)),
    winShares: round1(clamp(n(p.GP) * Math.max(0, impactProxy + 3) / 65, 0, 22)),
    boxPlusMinus: round1(impactProxy),
    estimatedPlusMinus: round1(impactProxy * 0.82),
  };
}

const currentStartYear = 2025;
const firstSeason = Number(process.env.HISTORIC_START_YEAR ?? 1946);
const lastSeason = Number(process.env.HISTORIC_END_YEAR ?? currentStartYear);
const allPlayers = [];
const failedSeasons = [];

console.log(`Building Historic Mode data from ${seasonLabel(firstSeason)} through ${seasonLabel(lastSeason)}…`);
console.log(`Position eligibility uses Basketball-Reference estimates at a ${Math.round(POSITION_ELIGIBILITY_THRESHOLD * 100)}% threshold when available.`);
console.log('The updater makes at most one NBA Stats and one Basketball-Reference request per season and can take several minutes.');

for (let year = firstSeason; year <= lastSeason; year += 1) {
  const season = seasonLabel(year);
  process.stdout.write(`Downloading ${season}… `);
  try {
    const rows = await getSeasonRows(season);
    let positionMap = new Map();
    // Basketball-Reference positional estimates rely on play-by-play coverage, which is unavailable for many early seasons.
    if (year >= Number(process.env.BREF_POSITION_START_YEAR ?? 1996)) {
      try {
        positionMap = await fetchBasketballReferencePositions(season);
      } catch (error) {
        console.warn(`\n  Positional estimates unavailable: ${error instanceof Error ? error.message : error}`);
      }
    }
    const seasonPlayers = rows
      .filter(player => n(player.GP) > 0 && player.PLAYER_NAME)
      .map(player => toPlayerSeason(player, season, positionMap));
    allPlayers.push(...seasonPlayers);
    console.log(`${seasonPlayers.length} player-seasons`);
  } catch (error) {
    failedSeasons.push(season);
    console.log(`skipped (${error instanceof Error ? error.message : error})`);
  }
  // Keep Basketball-Reference traffic comfortably below its published rate-limit trigger.
  await sleep(year >= Number(process.env.BREF_POSITION_START_YEAR ?? 1996) ? 2400 : 450);
}

if (allPlayers.length < 100) {
  console.error(`Only ${allPlayers.length} historical player-seasons were downloaded. The existing historical database was not replaced.`);
  process.exitCode = 1;
} else {
  allPlayers.sort((a, b) => a.season.localeCompare(b.season) || a.name.localeCompare(b.name));
  await writeFile(new URL('../src/data/historicalPlayers.json', import.meta.url), `${JSON.stringify(allPlayers, null, 2)}\n`);
  console.log(`\nSaved ${allPlayers.length} player-seasons to src/data/historicalPlayers.json.`);
  if (failedSeasons.length) console.warn(`Skipped seasons: ${failedSeasons.join(', ')}`);
  console.log('Restart npm run dev to load the new Historic Mode database.');
}
