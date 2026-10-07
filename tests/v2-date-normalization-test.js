#!/usr/bin/env node

import assert from 'node:assert/strict';

import { parseV2Database } from '../src/protocol/parser-v2.js';

function parseCompetitionDate(competitionDate) {
  return parseV2Database({
    competition: { competitionDate },
    athletes: []
  }).competition.date;
}

assert.equal(
  parseCompetitionDate('2026-08-26'),
  '2026-08-26',
  'ISO competition dates should be preserved'
);
assert.equal(
  parseCompetitionDate([2026, 8, 26]),
  '2026-08-26',
  'array competition dates should be formatted as ISO dates'
);

console.log('V2 date normalization tests passed');
