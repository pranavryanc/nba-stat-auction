import assert from 'node:assert/strict';
import { parseBasketballReferencePositions } from './basketball-reference-positions.mjs';

const fixture = `<!--
<table>
<thead><tr><th>Rk</th><th>Player</th><th>Tm</th><th>PG%</th><th>SG%</th><th>SF%</th><th>PF%</th><th>C%</th></tr></thead>
<tbody>
<tr><th>1</th><td>Hybrid Player</td><td>TST</td><td>30%</td><td>20%</td><td>25%</td><td>25%</td><td>0%</td></tr>
<tr><th>2</th><td>Single Position</td><td>TST</td><td>10%</td><td>15%</td><td>20%</td><td>22%</td><td>33%</td></tr>
</tbody>
</table>
-->`;

const parsed = parseBasketballReferencePositions(fixture, 0.25);
const hybrid = parsed.get('hybrid player')?.[0];
assert.deepEqual(hybrid?.detailedPositions, ['PG', 'SF']);
assert.deepEqual(hybrid?.eligiblePositions, ['G', 'F']);
const single = parsed.get('single position')?.[0];
assert.deepEqual(single?.detailedPositions, ['C']);
assert.equal(single?.position, 'C');
console.log('Position parser test passed.');
