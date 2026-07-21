#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';
import { computeDisplayMode, extractDecisionState, extractTimers } from '../src/utils/timer-decision-helpers.js';

console.log('✓ Testing athlete timer lifecycle behavior...\n');

const hub = new CompetitionHub();
hub.databaseState = { athletes: [{ key: 1 }] };

function currentTimerState() {
  const fopUpdate = hub.getFopUpdate({ fopName: 'A' });
  const { timer, breakTimer } = extractTimers(fopUpdate);
  const decision = extractDecisionState(fopUpdate);
  const { displayMode } = computeDisplayMode(timer, breakTimer, decision);
  return { fopUpdate, timer, decision, displayMode };
}

hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'TIME_RUNNING',
  mode: 'CURRENT_ATHLETE',
  athleteTimerEventType: 'StartTime',
  athleteMillisRemaining: '60000',
  athleteStartTimeMillis: String(Date.now()),
  timeAllowed: '60000'
}, 'timer');

hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'TIME_STOPPED',
  mode: 'CURRENT_ATHLETE',
  athleteTimerEventType: 'StopTime',
  athleteMillisRemaining: '57060',
  athleteStartTimeMillis: String(Date.now()),
  timeAllowed: '60000'
}, 'timer');

const stopped = currentTimerState();
assert.equal(stopped.timer.state, 'stopped', 'StopTime should freeze the athlete timer state');
assert.equal(stopped.timer.timeRemaining, 57060, 'StopTime should keep the reported frozen remaining time');
assert.equal(stopped.timer.startTime, null, 'StopTime should not keep a running start timestamp');
assert.equal(stopped.timer.visible, true, 'stopped timer should remain visible until the down signal arrives');
assert.equal(stopped.displayMode, 'athlete', 'stopped timer should own display before down signal');

const duplicateStop = hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'TIME_STOPPED',
  mode: 'CURRENT_ATHLETE',
  athleteTimerEventType: 'StopTime',
  athleteMillisRemaining: 57060,
  athleteStartTimeMillis: String(Date.now() + 1000),
  timeAllowed: '60000'
}, 'timer');
assert.equal(duplicateStop.suppressed, 'duplicate_stop', 'duplicate StopTime should be suppressed only when remaining time matches');

const correctiveStop = hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'TIME_STOPPED',
  mode: 'CURRENT_ATHLETE',
  athleteTimerEventType: 'StopTime',
  athleteMillisRemaining: '55625',
  athleteStartTimeMillis: String(Date.now() + 2000),
  timeAllowed: '60000'
}, 'timer');
assert.equal(correctiveStop.suppressed, undefined, 'StopTime with a different remaining time must not be suppressed');

const correctedStop = currentTimerState();
assert.equal(correctedStop.timer.timeRemaining, 55625, 'corrective StopTime should update the frozen remaining time');

hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'DOWN_SIGNAL_VISIBLE',
  mode: 'CURRENT_ATHLETE',
  decisionEventType: 'DOWN_SIGNAL',
  decisionsVisible: 'false',
  down: 'true'
}, 'decision');

const down = currentTimerState();
assert.equal(down.timer.timeRemaining, 55625, 'down signal must not mutate the frozen athlete timer');
assert.equal(down.decision.visible, true, 'down signal should own the display');
assert.equal(down.displayMode, 'decision', 'down signal should switch display mode to decision');

let fullDecisionEvent = null;
hub.once('decision', (eventData) => {
  fullDecisionEvent = eventData;
});

hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'DECISION_VISIBLE',
  mode: 'CURRENT_ATHLETE',
  decisionEventType: 'FULL_DECISION',
  decisionsVisible: 'true',
  d1: 'true',
  d2: 'true',
  d3: 'true',
  down: 'false'
}, 'decision');

const fullDecision = currentTimerState();
assert.equal(fullDecision.timer.timeRemaining, 55625, 'full decision must not mutate the frozen athlete timer');
assert.equal(fullDecision.decision.visible, true, 'full decision should own the display');
assert.equal(fullDecision.displayMode, 'decision', 'full decision should keep decision display mode');
assert.equal(fullDecisionEvent.data.fop, 'A', 'decision SSE event must include the merged FOP snapshot');
assert.equal(fullDecisionEvent.data.fopState, 'DECISION_VISIBLE', 'decision SSE snapshot must expose the visible decision state');
assert.equal(fullDecisionEvent.data.decisionEventType, 'FULL_DECISION', 'decision SSE snapshot must retain the event type');
assert.equal(fullDecisionEvent.data.athleteMillisRemaining, '55625', 'decision SSE snapshot must retain preceding FOP state');

hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'DECISION_VISIBLE',
  mode: 'CURRENT_ATHLETE',
  athleteTimerEventType: 'SetTime',
  athleteMillisRemaining: '120000',
  athleteInitialWarningMillis: '90000',
  athleteFinalWarningMillis: '30000',
  timeAllowed: '120000'
}, 'timer');

const preparedNextTimer = currentTimerState();
assert.equal(preparedNextTimer.timer.state, 'set', 'SetTime should prepare the next athlete timer state');
assert.equal(preparedNextTimer.timer.timeRemaining, 120000, 'SetTime should set the next athlete time value');
assert.equal(preparedNextTimer.timer.startTime, null, 'SetTime should not keep a running start timestamp');
assert.equal(preparedNextTimer.timer.visible, false, 'SetTime should not show a timer before its athlete is displayed');
assert.equal(preparedNextTimer.decision.visible, true, 'SetTime should not clear a visible decision display');
assert.equal(preparedNextTimer.displayMode, 'decision', 'SetTime should not switch display away from visible decisions');

hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'DECISION_VISIBLE',
  mode: 'CURRENT_ATHLETE',
  decisionEventType: 'RESET',
  decisionsVisible: 'false',
  down: 'false'
}, 'decision');

const reset = currentTimerState();
assert.equal(reset.timer.timeRemaining, 120000, 'decision reset must not mutate the prepared next athlete timer');
assert.equal(reset.timer.visible, false, 'decision reset should not show the prepared next athlete timer');
assert.equal(reset.decision.visible, false, 'decision reset should hide decision lights');
assert.equal(reset.displayMode, 'none', 'nothing should be displayed after reset until the next current-athlete update or timer start');

hub.handleOwlcmsMessage({
  fop: 'A',
  fopState: 'CURRENT_ATHLETE',
  mode: 'CURRENT_ATHLETE',
  currentAthleteKey: 1,
  athleteTimerEventType: 'SetTime',
  athleteMillisRemaining: '90000',
  athleteInitialWarningMillis: '90000',
  athleteFinalWarningMillis: '30000',
  timeAllowed: '90000',
  uiEvent: 'LiftingOrderUpdated'
}, 'update');

const nextAthlete = currentTimerState();
assert.equal(nextAthlete.fopUpdate.decisionEventType, undefined, 'next current-athlete update should clear stale decision state');
assert.equal(nextAthlete.timer.state, 'set', 'explicit SetTime should prepare the next athlete timer');
assert.equal(nextAthlete.timer.timeRemaining, 120000, 'update-carried SetTime must not mutate the prepared next athlete remaining time');
assert.equal(nextAthlete.timer.duration, 120000, 'update-carried timeAllowed must not mutate the prepared next athlete duration');
assert.equal(nextAthlete.timer.startTime, null, 'explicit SetTime should not keep a running start timestamp');
assert.equal(nextAthlete.timer.visible, true, 'current-athlete update should show the prepared athlete timer again');
assert.equal(nextAthlete.displayMode, 'athlete', 'current-athlete update should restore athlete display mode');

console.log('✓ Athlete timer stays frozen after stop and hidden after decision until next SetTime/StartTime\n');