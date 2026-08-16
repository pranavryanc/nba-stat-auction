import { readFile, writeFile } from 'node:fs/promises';

const DATA_FILES = [
  'src/data/players.json',
  'src/data/historicalPlayers.json',
];

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const GROUP = { PG: 'G', SG: 'G', SF: 'F', PF: 'F', C: 'C' };
const ADJACENT = {
  PG: ['SG'],
  SG: ['PG', 'SF'],
  SF: ['SG', 'PF'],
  PF: ['SF', 'C'],
  C: ['PF'],
};
const THRESHOLD = 25;

function sanitize(player) {
  const percentages = player.positionPercentages ?? {};
  let primary = player.listedDetailedPosition ?? player.primaryDetailedPosition;
  if (!POSITIONS.includes(primary)) primary = player.detailedPositions?.[0];
  if (!POSITIONS.includes(primary)) return player;

  const candidates = (ADJACENT[primary] ?? [])
    .filter(position => Number(percentages[position] ?? 0) >= THRESHOLD)
    .sort((a, b) => Number(percentages[b] ?? 0) - Number(percentages[a] ?? 0));

  const existingSecondary = player.detailedPositions?.find(position => (ADJACENT[primary] ?? []).includes(position));
  const secondary = candidates[0] ?? (percentages && Object.keys(percentages).length ? undefined : existingSecondary);
  const detailedPositions = secondary ? [primary, secondary] : [primary];

  return {
    ...player,
    primaryDetailedPosition: primary,
    listedDetailedPosition: player.listedDetailedPosition ?? primary,
    detailedPositions,
    eligiblePositions: [...new Set(detailedPositions.map(position => GROUP[position]))],
    position: GROUP[primary],
  };
}

for (const file of DATA_FILES) {
  const players = JSON.parse(await readFile(file, 'utf8'));
  const sanitized = players.map(sanitize);
  await writeFile(file, `${JSON.stringify(sanitized, null, 2)}\n`);
  console.log(`Sanitized ${sanitized.length} players in ${file}.`);
}
