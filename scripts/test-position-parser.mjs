import assert from 'node:assert/strict';
import { parseBasketballReferencePositions } from './basketball-reference-positions.mjs';

const fixture = `<!--
<table>
<thead><tr><th>Rk</th><th>Player</th><th>Tm</th><th>Pos</th><th>PG%</th><th>SG%</th><th>SF%</th><th>PF%</th><th>C%</th></tr></thead>
<tbody>
<tr><th>1</th><td>Listed Point Guard</td><td>TST</td><td>PG</td><td>30%</td><td>45%</td><td>25%</td><td>0%</td><td>0%</td></tr>
<tr><th>2</th><td>Listed Shooting Guard</td><td>TST</td><td>SG</td><td>16%</td><td>50%</td><td>34%</td><td>0%</td><td>0%</td></tr>
<tr><th>3</th><td>Listed Small Forward</td><td>TST</td><td>SF</td><td>30%</td><td>10%</td><td>35%</td><td>25%</td><td>0%</td></tr>
<tr><th>4</th><td>Listed Power Forward</td><td>TST</td><td>PF</td><td>0%</td><td>30%</td><td>25%</td><td>45%</td><td>0%</td></tr>
<tr><th>5</th><td>Listed Center</td><td>TST</td><td>C</td><td>0%</td><td>0%</td><td>25%</td><td>30%</td><td>45%</td></tr>
</tbody>
</table>
-->`;

const parsed = parseBasketballReferencePositions(fixture, 0.25);
// Primary always comes from the listed Pos column, even when another estimated
// positional-minute percentage is higher.
assert.deepEqual(parsed.get('listed point guard')?.[0]?.detailedPositions, ['PG', 'SG']);
assert.deepEqual(parsed.get('listed shooting guard')?.[0]?.detailedPositions, ['SG', 'SF']);
// PG is not adjacent to SF, so the 30% PG estimate is ignored.
assert.deepEqual(parsed.get('listed small forward')?.[0]?.detailedPositions, ['SF', 'PF']);
// SG is not adjacent to PF, so it cannot become a secondary position.
assert.deepEqual(parsed.get('listed power forward')?.[0]?.detailedPositions, ['PF', 'SF']);
// SF is not adjacent to C; only PF can be the secondary.
assert.deepEqual(parsed.get('listed center')?.[0]?.detailedPositions, ['C', 'PF']);
console.log('Position parser primary-position and adjacency tests passed.');
