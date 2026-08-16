import { writeFile } from 'node:fs/promises';
import { fetchBasketballReferencePositions, findPositionRecord, POSITION_ELIGIBILITY_THRESHOLD } from './basketball-reference-positions.mjs';

const season = '2025-26';
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
  PlayerExperience: '', PlayerPosition: '', PlusMinus: 'N', Rank: 'N', Season: season,
  SeasonSegment: '', SeasonType: 'Regular Season', ShotClockRange: '', StarterBench: '', TeamID: '0',
  TwoWay: '0', VsConference: '', VsDivision: '', Weight: '',
};

async function getRows(measureType) {
  const url = new URL(endpoint);
  Object.entries({ ...commonParams, MeasureType: measureType }).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`NBA Stats request failed (${response.status}) for ${measureType}`);
  const json = await response.json();
  const set = json.resultSets?.[0];
  if (!set) throw new Error(`No ${measureType} result set returned.`);
  return set.rowSet.map(row => Object.fromEntries(set.headers.map((header, i) => [header, row[i]])));
}

const teamNames = {
  ATL:'Atlanta Hawks',BOS:'Boston Celtics',BKN:'Brooklyn Nets',CHA:'Charlotte Hornets',CHI:'Chicago Bulls',CLE:'Cleveland Cavaliers',
  DAL:'Dallas Mavericks',DEN:'Denver Nuggets',DET:'Detroit Pistons',GSW:'Golden State Warriors',HOU:'Houston Rockets',IND:'Indiana Pacers',
  LAC:'Los Angeles Clippers',LAL:'Los Angeles Lakers',MEM:'Memphis Grizzlies',MIA:'Miami Heat',MIL:'Milwaukee Bucks',MIN:'Minnesota Timberwolves',
  NOP:'New Orleans Pelicans',NYK:'New York Knicks',OKC:'Oklahoma City Thunder',ORL:'Orlando Magic',PHI:'Philadelphia 76ers',PHX:'Phoenix Suns',
  POR:'Portland Trail Blazers',SAC:'Sacramento Kings',SAS:'San Antonio Spurs',TOR:'Toronto Raptors',UTA:'Utah Jazz',WAS:'Washington Wizards'
};

const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const pct = value => n(value) * 100;
const round1 = value => Math.round(value * 10) / 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const inferPosition = p => n(p.REB) >= 8 || (n(p.BLK) >= 1.4 && n(p.AST) < 4) ? 'C' : n(p.AST) >= 5 ? 'G' : 'F';
const inferEligiblePositions = (_p, primary) => [primary];

try {
  console.log(`Using a ${Math.round(POSITION_ELIGIBILITY_THRESHOLD * 100)}% positional-minutes threshold for eligibility.`);
  console.log('Downloading 2025–26 NBA base statistics…');
  const base = await getRows('Base');
  console.log('Downloading 2025–26 NBA advanced statistics…');
  const advanced = await getRows('Advanced');
  const advancedById = new Map(advanced.map(row => [row.PLAYER_ID, row]));
  let positionMap = new Map();
  try {
    console.log('Downloading Basketball-Reference positional-minute estimates…');
    positionMap = await fetchBasketballReferencePositions(season);
    console.log(`Matched positional estimates for ${positionMap.size} player names.`);
  } catch (error) {
    console.warn(`Position estimates were unavailable; using the statistical fallback (${error instanceof Error ? error.message : error}).`);
  }

  const players = base
    .filter(p => n(p.GP) > 0 && p.TEAM_ABBREVIATION)
    .map(p => {
      const a = advancedById.get(p.PLAYER_ID) ?? {};
      const points = round1(n(p.PTS));
      const rebounds = round1(n(p.REB));
      const assists = round1(n(p.AST));
      const steals = round1(n(p.STL));
      const blocks = round1(n(p.BLK));
      const impactProxy = round1((n(a.PIE) - 0.1) * 55);
      const fallbackPosition = inferPosition(p);
      const positionRecord = findPositionRecord(positionMap, p.PLAYER_NAME, p.TEAM_ABBREVIATION);
      const position = positionRecord?.position ?? fallbackPosition;
      return {
        id: n(p.PLAYER_ID),
        name: p.PLAYER_NAME,
        team: teamNames[p.TEAM_ABBREVIATION] ?? p.TEAM_ABBREVIATION,
        teamAbbreviation: p.TEAM_ABBREVIATION,
        position,
        eligiblePositions: positionRecord?.eligiblePositions ?? inferEligiblePositions(p, position),
        detailedPositions: positionRecord?.detailedPositions,
        primaryDetailedPosition: positionRecord?.primaryDetailedPosition,
        listedDetailedPosition: positionRecord?.listedDetailedPosition,
        positionPercentages: positionRecord?.positionPercentages,
        positionSource: positionRecord?.positionSource ?? 'statistical-fallback',
        photo: `https://cdn.nba.com/headshots/nba/latest/1040x760/${p.PLAYER_ID}.png`,
        teamLogo: `https://cdn.nba.com/logos/nba/${p.TEAM_ABBREVIATION}/global/L/logo.svg`,
        points, rebounds, assists, steals, blocks, season,
        price: Math.round(points + rebounds + assists + steals + blocks),
        threePointPercentage: round1(pct(p.FG3_PCT)),
        trueShooting: round1(pct(a.TS_PCT)),
        offensiveRating: round1(n(a.OFF_RATING)),
        defensiveRating: round1(n(a.DEF_RATING)),
        usageRate: round1(pct(a.USG_PCT)),
        assistPercentage: round1(pct(a.AST_PCT)),
        reboundPercentage: round1(pct(a.REB_PCT)),
        stealPercentage: round1(n(p.STL) / Math.max(n(p.MIN), 1) * 48),
        blockPercentage: round1(n(p.BLK) / Math.max(n(p.MIN), 1) * 48),
        playerEfficiencyRating: round1(clamp(15 + impactProxy * 1.5, 3, 35)),
        winShares: round1(clamp(n(p.GP) * Math.max(0, impactProxy + 2) / 55, 0, 18)),
        boxPlusMinus: impactProxy,
        estimatedPlusMinus: round1(impactProxy * 0.85),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (players.length < 80) throw new Error(`Only ${players.length} players were returned; refusing to overwrite the database.`);
  await writeFile(new URL('../src/data/players.json', import.meta.url), `${JSON.stringify(players, null, 2)}\n`);
  console.log(`Updated src/data/players.json with ${players.length} players from the ${season} regular season.`);
} catch (error) {
  console.error('\nCould not update player data.');
  console.error(error instanceof Error ? error.message : error);
  console.error('Your existing players.json file was not changed. Try again on a normal internet connection.');
  process.exitCode = 1;
}
