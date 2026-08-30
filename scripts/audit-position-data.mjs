import { readFile } from 'node:fs/promises';

const FILES = ['src/data/players.json', 'src/data/historicalPlayers.json'];
const ADJACENT = { PG: ['SG'], SG: ['PG', 'SF'], SF: ['SG', 'PF'], PF: ['SF', 'C'], C: ['PF'] };
let issues = 0;
for (const file of FILES) {
  const rows = JSON.parse(await readFile(file, 'utf8'));
  for (const player of rows) {
    const positions = player.detailedPositions ?? [];
    const primary = player.listedDetailedPosition ?? player.primaryDetailedPosition ?? positions[0];
    if (!primary) continue;
    if (
      player.listedDetailedPosition &&
      player.primaryDetailedPosition &&
      player.listedDetailedPosition !== player.primaryDetailedPosition
    ) {
      console.log(
        `${file}: ${player.name}${player.season ? ` (${player.season})` : ''} primary ${player.primaryDetailedPosition} disagrees with listed ${player.listedDetailedPosition}`,
      );
      issues += 1;
    }
    if (positions.length > 2) {
      console.log(`${file}: ${player.name} has more than two positions: ${positions.join('/')}`);
      issues += 1;
    }
    if (positions[1] && !(ADJACENT[primary] ?? []).includes(positions[1])) {
      console.log(`${file}: ${player.name} has invalid pair ${primary}/${positions[1]}`);
      issues += 1;
    }
    if (positions[1] && Number(player.positionPercentages?.[positions[1]] ?? 0) < 25) {
      console.log(`${file}: ${player.name} secondary ${positions[1]} is below 25%`);
      issues += 1;
    }
  }
}
if (issues) {
  console.error(
    `Position audit found ${issues} issue(s). Run npm run update-data / update-history, then sanitize again.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    'Position audit passed. Primary positions, adjacency, and 25% secondary eligibility are consistent.',
  );
}
