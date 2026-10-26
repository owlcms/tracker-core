#!/usr/bin/env node

import assert from 'node:assert/strict';

import { extractV2Year, parseV2Database } from '../src/protocol/parser-v2.js';

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

function parseAthleteYearOfBirth(fullBirthDate) {
  return parseV2Database({
    competition: { competitionDate: '2026-08-26' },
    athletes: [{ key: 1, firstName: 'John', lastName: 'Doe', fullBirthDate }]
  }).athletes[0].yearOfBirth;
}

assert.equal(
  parseAthleteYearOfBirth('2007-01-01'),
  '2007',
  'ISO birth dates should yield the four-digit year'
);
assert.equal(
  parseAthleteYearOfBirth([2007, 1, 1]),
  '2007',
  'array birth dates should yield the year'
);
assert.equal(
  parseAthleteYearOfBirth(null),
  null,
  'missing birth dates should yield null'
);

assert.equal(extractV2Year('1995-03-15'), '1995');
assert.equal(extractV2Year([1995, 3, 15]), '1995');
assert.equal(extractV2Year('garbage'), null);
assert.equal(extractV2Year(undefined), null);

console.log('V2 date normalization tests passed');
