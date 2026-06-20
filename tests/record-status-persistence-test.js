#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';

console.log('✓ Testing record status idempotency across decision and update messages...\n');

const hub = new CompetitionHub();

// Baseline current athlete (no record challenge yet).
hub.handleOwlcmsMessage({
	fop: 'A',
	fullName: 'Jane Lifter',
	fopState: 'CURRENT_ATHLETE',
	uiEvent: 'LiftingOrderUpdated'
}, 'update');

hub.databaseRequested = 0;

// A FULL_DECISION announces a new record. Decision frames carry the outcome and
// must surface recordKind/recordMessage on FOP state.
hub.handleOwlcmsMessage({
	fop: 'A',
	decisionEventType: 'FULL_DECISION',
	recordKind: 'new',
	recordMessage: 'New Record'
}, 'decision');

let update = hub.getFopUpdate({ fopName: 'A' });
assert.equal(update.recordKind, 'new', 'decision events should store the new-record kind on FOP state');
assert.equal(update.recordMessage, 'New Record', 'decision events should store the new-record message on FOP state');

hub.databaseRequested = 0;

// A subsequent update that does NOT mention a record must NOT inherit the stale
// record state. recordKind is owned by update frames and recomputed each time:
// it must not "stick" once the current athlete is no longer attempting a record.
hub.handleOwlcmsMessage({
	fop: 'A',
	fullName: 'Next Lifter',
	fopState: 'CURRENT_ATHLETE',
	uiEvent: 'LiftingOrderUpdated'
}, 'update');

update = hub.getFopUpdate({ fopName: 'A' });
assert.equal(update.recordKind, undefined, 'updates without a record must wipe stale recordKind (no sticking)');
assert.equal(update.recordMessage, undefined, 'updates without a record must wipe stale recordMessage');

hub.databaseRequested = 0;

// "attempt" is shown only when the current athlete is actually challenging a record,
// i.e. only when an update explicitly says so.
hub.handleOwlcmsMessage({
	fop: 'A',
	fullName: 'Challenger',
	fopState: 'CURRENT_ATHLETE',
	recordKind: 'attempt',
	recordMessage: 'Record Attempt',
	uiEvent: 'LiftingOrderUpdated'
}, 'update');

update = hub.getFopUpdate({ fopName: 'A' });
assert.equal(update.recordKind, 'attempt', 'an update for a challenging athlete should show the attempt status');
assert.equal(update.recordMessage, 'Record Attempt', 'an update for a challenging athlete should carry the attempt message');

hub.databaseRequested = 0;

// When the next athlete is not challenging, an explicit none clears it.
hub.handleOwlcmsMessage({
	fop: 'A',
	fullName: 'Plain Lifter',
	fopState: 'CURRENT_ATHLETE',
	recordKind: 'none',
	uiEvent: 'LiftingOrderUpdated'
}, 'update');

update = hub.getFopUpdate({ fopName: 'A' });
assert.equal(update.recordKind, 'none', 'an explicit none from OWLCMS should clear the record status');

console.log('✓ Record status is idempotent: attempt shows only for a challenging athlete and never sticks on stale updates\n');