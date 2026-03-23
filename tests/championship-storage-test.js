#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';

console.log('✓ Testing championship storage in tracker-core...\n');

const hub = new CompetitionHub();

// Input matches the actual V2 ChampionshipDTO field names from owlcms
// (see owlcms/src/main/java/app/owlcms/data/export/v2/ChampionshipDTO.java)
const result = hub.handleFullCompetitionData({
  databaseChecksum: 'championship-test-checksum',
  competition: {
    competitionName: 'Championship Field Test'
  },
  athletes: [
    {
      id: 1,
      key: '1',
      firstName: 'Test',
      lastName: 'Athlete',
      gender: 'M',
      categoryCode: 'SR_M89',
      team: 10,
      sessionName: 'A'
    }
  ],
  teams: [
    {
      id: 10,
      name: 'TEST'
    }
  ],
  championships: [
    {
      name: 'Senior',
      type: 'IWF',
      scoringSystem: 'BW_SINCLAIR',
      bestAthleteScoringSystem: 'GAMX',
      bestSnatchScoringSystem: 'GAMX_S',
      bestCJScoringSystem: 'GAMX_C',
      snatchCJTotalMedals: true,
      teamPoints1st: 28,
      teamPoints2nd: 25,
      teamPoints3rd: 23,
      mensBestN: 5,
      womensBestN: 4,
      mixedMensBestN: 2,
      mixedWomensBestN: 2,
      mixedBestN: 8,
      explicitTeamSize: 6,
      maxTeamSize: 8,
      maxPerCategory: 2,
      explicitMixedTeamMembers: true,
      teamScoringSystem: 'QPOINTS',
      mixedTeamScoringSystem: 'GAMX',
      customFutureField: 'preserve-me'
    }
  ],
  ageGroups: [],
  platforms: []
});

assert.equal(result.accepted, true, 'database load should be accepted');

const db = hub.getDatabaseState();
assert.ok(Array.isArray(db.championships), 'championships should be stored as an array');
assert.equal(db.championships.length, 1, 'one championship should be stored');

const championship = db.championships[0];

// Identity fields
assert.equal(championship.name, 'Senior', 'name should be stored');
assert.equal(championship.type, 'IWF', 'type should be stored');

// Scoring systems
assert.equal(championship.scoringSystem, 'BW_SINCLAIR', 'scoringSystem');
assert.equal(championship.bestAthleteScoringSystem, 'GAMX', 'bestAthleteScoringSystem');
assert.equal(championship.bestSnatchScoringSystem, 'GAMX_S', 'bestSnatchScoringSystem');
assert.equal(championship.bestCJScoringSystem, 'GAMX_C', 'bestCJScoringSystem');
assert.equal(championship.snatchCJTotalMedals, true, 'snatchCJTotalMedals');

// Team points
assert.equal(championship.teamPoints1st, 28, 'teamPoints1st');
assert.equal(championship.teamPoints2nd, 25, 'teamPoints2nd');
assert.equal(championship.teamPoints3rd, 23, 'teamPoints3rd');

// Team size configuration
assert.equal(championship.mensBestN, 5, 'mensBestN');
assert.equal(championship.womensBestN, 4, 'womensBestN');
assert.equal(championship.mixedMensBestN, 2, 'mixedMensBestN');
assert.equal(championship.mixedWomensBestN, 2, 'mixedWomensBestN');
assert.equal(championship.mixedBestN, 8, 'mixedBestN');
assert.equal(championship.explicitTeamSize, 6, 'explicitTeamSize');
assert.equal(championship.maxTeamSize, 8, 'maxTeamSize');
assert.equal(championship.maxPerCategory, 2, 'maxPerCategory');
assert.equal(championship.explicitMixedTeamMembers, true, 'explicitMixedTeamMembers');

// Team scoring systems
assert.equal(championship.teamScoringSystem, 'QPOINTS', 'teamScoringSystem');
assert.equal(championship.mixedTeamScoringSystem, 'GAMX', 'mixedTeamScoringSystem');

// Unknown future fields should be preserved via object spread
assert.equal(championship.customFutureField, 'preserve-me', 'unknown future fields preserved');

// championshipMap keyed by name
assert.ok(db.championshipMap.Senior, 'championshipMap keyed by name');
assert.equal(db.championshipMap.Senior.mensBestN, 5, 'championshipMap entry has correct fields');
assert.equal(db.championshipMap.Senior.teamScoringSystem, 'QPOINTS', 'championshipMap entry has scoring fields');

console.log('✓ Championship attributes stored and normalized correctly\n');