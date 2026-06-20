#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';
import { extractTimers } from '../src/utils/timer-decision-helpers.js';

console.log('✓ Testing break resync behavior...\n');

const hub = new CompetitionHub();

hub.handleOwlcmsMessage({
  fop: 'BLUE',
  fopState: 'BREAK',
  break: 'true',
  breakType: 'TECHNICAL',
  breakMillisRemaining: '579000',
  uiEvent: 'LiftingOrderUpdated'
}, 'update');

const firstUpdate = hub.getFopUpdate({ fopName: 'BLUE' });
const synthesizedBreakStart = Number.parseInt(firstUpdate.breakStartTimeMillis, 10);

assert.ok(Number.isFinite(synthesizedBreakStart) && synthesizedBreakStart > 0,
  'hub should synthesize breakStartTimeMillis when reconnecting mid-break');

const firstTimers = extractTimers(firstUpdate);
assert.equal(firstTimers.breakTimer.visible, true,
  'break timer should remain visible after resync without an original BreakStarted event');
assert.ok(firstTimers.breakTimer.timeRemaining > 0,
  'break timer should keep a positive countdown after resync');

hub.handleOwlcmsMessage({
  fop: 'BLUE',
  fopState: 'BREAK',
  break: 'true',
  breakType: 'TECHNICAL',
  uiEvent: 'LiftingOrderUpdated'
}, 'update');

const secondUpdate = hub.getFopUpdate({ fopName: 'BLUE' });
assert.equal(secondUpdate.breakStartTimeMillis, String(synthesizedBreakStart),
  'hub should preserve the synthesized breakStartTimeMillis across later update snapshots');

const secondTimers = extractTimers(secondUpdate);
assert.equal(secondTimers.breakTimer.visible, true,
  'later break updates should stay visible after synthesized start-time resync');

console.log('✓ Break resync synthesizes and preserves break start time\n');