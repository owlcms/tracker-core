#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';

console.log('✓ Testing broadcast debounce behavior...\n');

const hub = new CompetitionHub();
hub.broadcastDebounceMs = 1000;

const received = [];
const unsubscribe = hub.subscribe((message) => {
  received.push(message);
});

received.length = 0;

hub.broadcast({
  type: 'timer',
  fop: 'RED',
  timer: {
    state: 'set',
    breakState: 'none',
    timeRemaining: 60000,
    breakRemaining: 0
  },
  displayMode: 'athlete',
  timestamp: Date.now()
});

hub.broadcast({
  type: 'timer',
  fop: 'RED',
  timer: {
    state: 'running',
    breakState: 'none',
    timeRemaining: 60000,
    breakRemaining: 0
  },
  displayMode: 'athlete',
  timestamp: Date.now()
});

hub.broadcast({
  type: 'timer',
  fop: 'RED',
  timer: {
    state: 'running',
    breakState: 'none',
    timeRemaining: 60000,
    breakRemaining: 0
  },
  displayMode: 'athlete',
  timestamp: Date.now()
});

assert.equal(received.length, 2, 'timer set->running should both broadcast, duplicate running should debounce');
assert.deepEqual(
  received.map((message) => message.timer?.state),
  ['set', 'running'],
  'timer debounce should preserve state transitions'
);

received.length = 0;

hub.broadcast({
  type: 'decision',
  fop: 'BLUE',
  decision: {
    type: 'decision',
    visible: true,
    down: false,
    ref1: 'good',
    ref2: 'good',
    ref3: 'bad',
    juryDecision: null,
    juryReversal: null
  },
  displayMode: 'decision',
  timestamp: Date.now()
});

hub.broadcast({
  type: 'decision',
  fop: 'BLUE',
  decision: {
    type: 'decision',
    visible: true,
    down: true,
    ref1: 'good',
    ref2: 'good',
    ref3: 'bad',
    juryDecision: null,
    juryReversal: null
  },
  displayMode: 'decision',
  timestamp: Date.now()
});

hub.broadcast({
  type: 'decision',
  fop: 'BLUE',
  decision: {
    type: 'decision',
    visible: true,
    down: true,
    ref1: 'good',
    ref2: 'good',
    ref3: 'bad',
    juryDecision: null,
    juryReversal: null
  },
  displayMode: 'decision',
  timestamp: Date.now()
});

assert.equal(received.length, 3, 'decision broadcasts should not be debounced');
assert.deepEqual(
  received.map((message) => message.decision?.down),
  [false, true, true],
  'decision broadcasts should preserve duplicate and changed payloads'
);

unsubscribe();

console.log('✓ Broadcast debounce preserves state changes and suppresses true duplicates\n');
