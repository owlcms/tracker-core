#!/usr/bin/env node

import assert from 'node:assert/strict';

import { interpolateParams } from '../src/scoring/gamx2.js';

console.log('✓ Testing GAMX body mass lookup...\n');

// Age tables: mu marks the row used. Senior table: mu is the body mass, so interpolation is visible.
const ageTable = [];
for (let tenths = 500; tenths <= 900; tenths++) {
  const bodyMass = tenths / 10;
  ageTable.push([40, bodyMass, bodyMass, 0.1, 1]);
}
const seniorTable = [[85.2, 85.2, 0.1, 1], [85.3, 85.3, 0.1, 1]];

// Rounding directions observed in the online calculators (R's round(x, 1)).
const expectedRows = {
  60.15: 60.1, 60.25: 60.2, 60.35: 60.4, 60.45: 60.5, 60.55: 60.5, 60.75: 60.8, 60.95: 61.0,
  85.15: 85.2, 85.23: 85.2, 85.25: 85.2, 85.35: 85.3, 85.45: 85.4, 85.55: 85.6, 85.85: 85.8,
  53.44: 53.4, 53.45: 53.5, 53.55: 53.5, 53.56: 53.6
};
for (const [bodyMass, row] of Object.entries(expectedRows)) {
  const { mu } = interpolateParams(ageTable, Number(bodyMass), true, 40);
  assert.equal(mu, row, `age table at ${bodyMass} kg should use the ${row} kg row`);
}

const senior = interpolateParams(seniorTable, 85.25, false);
assert.ok(Math.abs(senior.mu - 85.25) < 1e-9, 'senior table should interpolate');

console.log('✓ Age tables use the 0.1 kg row; senior tables interpolate\n');
