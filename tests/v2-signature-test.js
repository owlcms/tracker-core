#!/usr/bin/env node

// OWLCMS V2 exports end with a top-level "signature" object (compliance 145).
// The parser reads known fields by name, so the signature must be ignored.

import assert from 'node:assert/strict';

import { parseV2Database } from '../src/protocol/parser-v2.js';

function database() {
  return {
    formatVersion: '2.0',
    competition: { competitionName: 'Fixture', competitionDate: '2026-08-26' },
    teams: [{ id: 1, name: 'Team' }],
    athletes: [{ key: 1, firstName: 'John', lastName: 'Doe', team: 1, fullBirthDate: '2007-01-01' }]
  };
}

const signed = {
  ...database(),
  signature: {
    alg: 'Ed25519',
    publicKey: 'A'.repeat(59) + '=',
    keyFingerprint: '0'.repeat(64),
    sha256: '1'.repeat(64),
    value: 'B'.repeat(86) + '=='
  }
};

const fromUnsigned = parseV2Database(database());
const fromSigned = parseV2Database(signed);

assert.ok(fromSigned, 'a signed export should parse');
assert.equal('signature' in fromSigned, false, 'the signature should not reach the normalized database');
// lastUpdate is the parse time
delete fromUnsigned.lastUpdate;
delete fromSigned.lastUpdate;
assert.deepEqual(fromSigned, fromUnsigned, 'a signed export should parse exactly like the unsigned one');

console.log('v2-signature-test: OK');
