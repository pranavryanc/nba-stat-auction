import assert from 'node:assert/strict';
import { parseBasketballReferencePositions } from './basketball-reference-positions.mjs';

const fixture = `<!--
<table>
<thead><tr><th>Rk</th><th>Player</th><th>Tm</th><th>PG%</th><th>SG%</th><th>SF%</th><th>PF%</th><th>C%</th></tr></thead>
<tbody>
<tr><th>1</th><td>Guard Hybrid</td><td>TST</td><td>30%</td><td>35%</td><td>25%</td><td>10%</td><td>0%</td></tr>
<tr><th>2</th><td>Forward Hybrid</td><td>TST</td><td>0%</td><td>10%</td><td>40%</td><td>30%</td><td>20%</td></tr>
<tr><th>3</th><td>Center Hybrid</td><td>TST</td><td>0%</td><td>0%</td><td>25%</td><td>30%</td><td>45%</td></tr>
<tr><th>4</th><td>Invalid SF Center</td><td>TST</td><td>0%</td><td>0%</td><td>60%</td><td>0%</td><td>40%</td></tr>
<tr><th>5</th><td>Invalid PF Guard</td><td>TST</td><td>0%</td><td>30%</td><td>0%</td><td>70%</td><td>0%</td></tr>
</tbody>
</table>
-->`;

const parsed = parseBasketballReferencePositions(fixture, 0.25);
assert.deepEqual(parsed.get('guard hybrid')?.[0]?.detailedPositions, ['SG', 'PG']);
assert.deepEqual(parsed.get('forward hybrid')?.[0]?.detailedPositions, ['SF', 'PF']);
assert.deepEqual(parsed.get('center hybrid')?.[0]?.detailedPositions, ['C', 'PF']);
assert.deepEqual(parsed.get('invalid sf center')?.[0]?.detailedPositions, ['SF']);
assert.deepEqual(parsed.get('invalid pf guard')?.[0]?.detailedPositions, ['PF']);
console.log('Position parser adjacency tests passed.');
