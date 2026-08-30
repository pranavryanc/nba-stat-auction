const DEFAULT_THRESHOLD = 0.25;
const POSITION_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
const GROUP_BY_POSITION = { PG: 'G', SG: 'G', SF: 'F', PF: 'F', C: 'C' };

// A secondary position may only be one positional step away from the
// player's primary position. The secondary position must still meet the
// 25% minimum-minute requirement.
const ADJACENT_POSITIONS = {
  PG: ['SG'],
  SG: ['PG', 'SF'],
  SF: ['SG', 'PF'],
  PF: ['SF', 'C'],
  C: ['PF'],
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .trim();
}

export function normalizePlayerName(value) {
  return String(value ?? '')
    .replace(/\*/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.’']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function parsePercent(value) {
  const parsed = Number(
    String(value ?? '')
      .replace('%', '')
      .trim(),
  );
  if (!Number.isFinite(parsed)) return 0;
  return parsed > 1 ? parsed / 100 : parsed;
}

function getCells(rowHtml) {
  return [...rowHtml.matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((match) => ({
    text: decodeHtml(match[3]),
  }));
}

function findPositionTable(html) {
  const uncommented = html.replace(/<!--([\s\S]*?)-->/g, '$1');
  const tables = [...uncommented.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(
    (match) => match[0],
  );
  return (
    tables.find((table) => POSITION_ORDER.every((position) => table.includes(`${position}%`))) ??
    null
  );
}

export function parseBasketballReferencePositions(html, threshold = DEFAULT_THRESHOLD) {
  const table = findPositionTable(html);
  if (!table) throw new Error('Could not find the Basketball-Reference positional-minutes table.');

  const rows = [...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  let headers = [];
  for (const row of rows) {
    const cells = getCells(row).map((cell) => cell.text);
    if (
      cells.includes('Player') &&
      POSITION_ORDER.every((position) => cells.includes(`${position}%`))
    )
      headers = cells;
  }
  if (!headers.length) throw new Error('Could not identify position-percentage columns.');

  const playerIndex = headers.indexOf('Player');
  const teamIndex = headers.indexOf('Tm');
  const listedPositionIndex = headers.indexOf('Pos');
  const positionIndexes = Object.fromEntries(
    POSITION_ORDER.map((position) => [position, headers.indexOf(`${position}%`)]),
  );
  const result = new Map();

  for (const row of rows) {
    const cells = getCells(row).map((cell) => cell.text);
    if (!cells.length || cells.includes('Player')) continue;
    const name = cells[playerIndex];
    if (!name) continue;

    const percentages = Object.fromEntries(
      POSITION_ORDER.map((position) => [
        position,
        positionIndexes[position] >= 0 ? parsePercent(cells[positionIndexes[position]]) : 0,
      ]),
    );
    const maxPercentage = Math.max(...Object.values(percentages));
    if (maxPercentage <= 0) continue;

    // Basketball-Reference's listed Pos column is the source of truth for the
    // player's primary position. The positional-minute percentages are used
    // only to grant an adjacent secondary position. This prevents a high
    // estimated percentage at an unusual spot from changing a player's
    // primary position (for example, turning a wing into a point guard).
    const listedPositionText =
      listedPositionIndex >= 0 ? String(cells[listedPositionIndex] ?? '') : '';
    const listedDetailedPosition = POSITION_ORDER.find((position) =>
      new RegExp(`(^|[^A-Z])${position}([^A-Z]|$)`).test(listedPositionText.toUpperCase()),
    );
    const primaryDetailedPosition =
      listedDetailedPosition ??
      POSITION_ORDER.find((position) => percentages[position] === maxPercentage) ??
      'SF';
    const secondaryDetailedPosition = (ADJACENT_POSITIONS[primaryDetailedPosition] ?? [])
      .filter((position) => percentages[position] >= threshold)
      .sort((a, b) => percentages[b] - percentages[a])[0];
    const detailedPositions = secondaryDetailedPosition
      ? [primaryDetailedPosition, secondaryDetailedPosition]
      : [primaryDetailedPosition];
    const eligiblePositions = [
      ...new Set(detailedPositions.map((position) => GROUP_BY_POSITION[position])),
    ];
    const entry = {
      name: name.replace(/\*/g, '').trim(),
      teamAbbreviation: cells[teamIndex] ?? '',
      detailedPositions,
      primaryDetailedPosition,
      listedDetailedPosition: listedDetailedPosition ?? primaryDetailedPosition,
      eligiblePositions,
      position: GROUP_BY_POSITION[primaryDetailedPosition],
      positionPercentages: Object.fromEntries(
        POSITION_ORDER.map((position) => [position, Math.round(percentages[position] * 1000) / 10]),
      ),
      positionSource: 'basketball-reference-position-estimate',
    };
    const key = normalizePlayerName(name);
    const existing = result.get(key) ?? [];
    existing.push(entry);
    result.set(key, existing);
  }
  return result;
}

export function findPositionRecord(positionMap, playerName, teamAbbreviation = '') {
  const records = positionMap?.get(normalizePlayerName(playerName)) ?? [];
  if (!records.length) return null;
  return (
    records.find((record) => record.teamAbbreviation === teamAbbreviation) ??
    records.find((record) => record.teamAbbreviation === 'TOT') ??
    records[0]
  );
}

export async function fetchBasketballReferencePositions(season, options = {}) {
  const threshold = Number(options.threshold ?? DEFAULT_THRESHOLD);
  const endYear = Number(season.slice(0, 4)) + 1;
  const url = `https://www.basketball-reference.com/leagues/NBA_${endYear}_play-by-play.html`;
  const headers = {
    'User-Agent': 'NBA Stat Auction data updater (personal project; one request per season)',
    Accept: 'text/html,application/xhtml+xml',
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
    if (response.ok) return parseBasketballReferencePositions(await response.text(), threshold);
    if (response.status === 404) return new Map();
    if (attempt === 3)
      throw new Error(`Basketball-Reference request failed (${response.status}) for ${season}`);
    await sleep(attempt * 2000);
  }
  return new Map();
}

export function isValidDetailedPositionPair(positions) {
  if (!Array.isArray(positions) || positions.length < 1 || positions.length > 2) return false;
  if (positions.length === 1) return POSITION_ORDER.includes(positions[0]);
  const [primary, secondary] = positions;
  return (ADJACENT_POSITIONS[primary] ?? []).includes(secondary);
}

export function sanitizeDetailedPositions(
  positions,
  percentages = {},
  threshold = DEFAULT_THRESHOLD,
) {
  if (!Array.isArray(positions) || !positions.length) return [];
  const primary = positions[0];
  if (!POSITION_ORDER.includes(primary)) return [];
  const secondary = (ADJACENT_POSITIONS[primary] ?? [])
    .filter((position) => Number(percentages[position] ?? 0) >= threshold)
    .sort((a, b) => Number(percentages[b] ?? 0) - Number(percentages[a] ?? 0))[0];
  return secondary ? [primary, secondary] : [primary];
}

export const POSITION_ELIGIBILITY_THRESHOLD = DEFAULT_THRESHOLD;
