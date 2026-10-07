#!/usr/bin/env node

import assert from 'node:assert/strict';

import { parseV2Database } from '../src/protocol/parser-v2.js';

function parseAthlete(categoryCode, participations) {
  return parseV2Database({
    athletes: [{
      key: '1',
      firstName: 'Test',
      lastName: 'Athlete',
      categoryCode,
      participations
    }]
  }).athletes[0];
}

const otherParticipation = { categoryCode: 'U20_F86', totalRank: 2 };
const registrationParticipation = { categoryCode: 'PSR_F86', totalRank: 5 };

const reordered = parseAthlete('PSR_F86', [
  otherParticipation,
  registrationParticipation
]);

assert.deepEqual(
  reordered.participations,
  [registrationParticipation, otherParticipation],
  'registration category participation should be first'
);

const alreadyOrdered = parseAthlete('PSR_F86', [
  registrationParticipation,
  otherParticipation
]);

assert.deepEqual(
  alreadyOrdered.participations,
  [registrationParticipation, otherParticipation],
  'existing participation order should be preserved when registration category is already first'
);

const noRegistrationMatch = parseAthlete('PSR_F71', [
  otherParticipation,
  registrationParticipation
]);

assert.deepEqual(
  noRegistrationMatch.participations,
  [otherParticipation, registrationParticipation],
  'participation order should be preserved when registration category is not present'
);

console.log('Participation ordering tests passed');
