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

const firstUpdate = hub.fopUpdates.BLUE;
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

const secondUpdate = hub.fopUpdates.BLUE;
assert.equal(secondUpdate.breakStartTimeMillis, String(synthesizedBreakStart),
  'hub should preserve the synthesized breakStartTimeMillis across later update snapshots');

const secondTimers = extractTimers(secondUpdate);
assert.equal(secondTimers.breakTimer.visible, true,
  'later break updates should stay visible after synthesized start-time resync');

console.log('✓ Break resync synthesizes and preserves break start time\n');

console.log('✓ Testing before-introduction break reload resync...\n');

const originalDateNow = Date.now;
let fakeNow = 1_000_000;
Date.now = () => fakeNow;

try {
  const beforeIntroHub = new CompetitionHub();

  beforeIntroHub.handleOwlcmsMessage({
    fop: 'BLUE',
    fopState: 'BREAK',
    break: 'true',
    breakType: 'BEFORE_INTRODUCTION',
    breakMillisRemaining: '600000',
    breakStartTimeMillis: String(fakeNow),
    uiEvent: 'LiftingOrderUpdated'
  }, 'update');

  const firstBeforeIntroUpdate = beforeIntroHub.fopUpdates.BLUE;
  const firstBeforeIntroStart = Number.parseInt(firstBeforeIntroUpdate.breakStartTimeMillis, 10);

  fakeNow += 120000;

  beforeIntroHub.handleOwlcmsMessage({
    fop: 'BLUE',
    fopState: 'BREAK',
    break: 'true',
    breakType: 'BEFORE_INTRODUCTION',
    breakMillisRemaining: '600000',
    breakStartTimeMillis: String(fakeNow),
    uiEvent: 'LiftingOrderUpdated'
  }, 'update');

  const reloadedBeforeIntroUpdate = beforeIntroHub.fopUpdates.BLUE;
  assert.equal(Number.parseInt(reloadedBeforeIntroUpdate.breakStartTimeMillis, 10), firstBeforeIntroStart,
    'before-introduction reload updates must preserve the original break start anchor');

  const reloadedBeforeIntroTimers = extractTimers(reloadedBeforeIntroUpdate);
  assert.ok(reloadedBeforeIntroTimers.breakTimer.timeRemaining <= 480000,
    'before-introduction reload updates must recompute elapsed time instead of resetting to the initial duration');
} finally {
  Date.now = originalDateNow;
}

console.log('✓ Before-introduction break reload keeps elapsed countdown\n');

console.log('✓ Testing break endTimeMillis anchor survives cached snapshots...\n');

{
  const anchorNow = Date.now;
  let anchorClock = 2_000_000;
  Date.now = () => anchorClock;
  try {
    const fopUpdate = {
      fopState: 'BREAK',
      break: 'true',
      breakType: 'BEFORE_INTRODUCTION',
      breakMillisRemaining: '600000',
      breakStartTimeMillis: String(anchorClock)
    };

    const atStart = extractTimers(fopUpdate).breakTimer;
    const expectedEnd = anchorClock + 600000;
    assert.equal(atStart.endTimeMillis, expectedEnd,
      'breakTimer.endTimeMillis must equal breakStartTimeMillis + breakMillisRemaining');
    assert.equal(atStart.timeRemaining, 600000,
      'at break start the remaining equals the full duration');

    // Simulate the API response cache freezing the timeRemaining snapshot: OWLCMS sends
    // no further break message, so a client reloading 90s later receives the SAME object.
    // endTimeMillis stays fixed, so a client computing endTimeMillis - now gets the true
    // remaining even though the cached timeRemaining snapshot is stale.
    anchorClock += 90000;
    const cachedSnapshot = atStart; // unchanged cached object
    const clientRemaining = Math.max(0, cachedSnapshot.endTimeMillis - Date.now());
    assert.equal(clientRemaining, 510000,
      'client must recompute remaining from endTimeMillis, not the frozen snapshot');
  } finally {
    Date.now = anchorNow;
  }
}

console.log('✓ Break endTimeMillis anchor stays correct across stale snapshots\n');

{
  const originalNow = Date.now;
  let now = 3_000_000;
  Date.now = () => now;
  try {
    const ceremonyHub = new CompetitionHub();
    const startedAt = now;
    const start = {
      fop: 'A', fopState: 'BREAK', break: 'true', breakType: 'FIRST_SNATCH', mode: 'LIFT_COUNTDOWN',
      breakTimerEventType: 'BreakStarted', indefiniteBreak: 'false',
      breakStartTimeMillis: String(startedAt), breakMillisRemaining: '20000'
    };
    ceremonyHub.handleOwlcmsMessage(start, 'timer');

    for (const [elapsed, mode, ceremonyType] of [
      [5000, 'LIFT_COUNTDOWN_CEREMONY', 'OFFICIALS_INTRODUCTION'],
      [10000, 'LIFT_COUNTDOWN', null],
      [19000, 'LIFT_COUNTDOWN', null]
    ]) {
      now = startedAt + elapsed;
      ceremonyHub.handleOwlcmsMessage({
        ...start, mode, ceremonyType, uiEvent: 'InitialSync', breakMillisRemaining: 20000 - elapsed
      }, 'update');
      const timer = extractTimers(ceremonyHub.fopUpdates.A).breakTimer;
      assert.equal(timer.timeRemaining, 20000 - elapsed, 'live remaining must not have elapsed time subtracted twice');
      assert.equal(timer.endTimeMillis, startedAt + 20000, 'ceremony updates keep the original countdown deadline');
      assert.equal(timer.visible, true);
    }

    const joiningHub = new CompetitionHub();
    joiningHub.handleOwlcmsMessage({ ...start, breakMillisRemaining: 1000 }, 'update');
    assert.equal(extractTimers(joiningHub.fopUpdates.A).breakTimer.timeRemaining, 1000,
      'a tracker joining mid-break uses the live remaining time');

    const indefiniteTimer = extractTimers({ ...start, indefiniteBreak: true, breakMillisRemaining: null }).breakTimer;
    assert.equal(indefiniteTimer.visible, false, 'an indefinite break must not show a fabricated countdown');
  } finally {
    Date.now = originalNow;
  }
}

console.log('✓ Ceremony and keepalive updates preserve the running break deadline\n');
