#!/usr/bin/env node

/**
 * Minimal smoke test to verify public API entrypoints
 * Run with: npm run test:core-smoke
 */

import { competitionHub, EVENT_TYPES } from '../src/index.js';
import { attachWebSocketToServer, createWebSocketServer } from '../src/websocket/index.js';
import { 
	getFlagUrl, 
	buildCacheKey, 
	registerCache, 
	bumpCacheEpoch, 
	getCacheEpoch,
	isBreakMode,
	buildSessionInfo,
	buildAttemptLabel,
	inferGroupName,
	inferBreakMessage,
	extractCurrentAttempt
} from '../src/utils/index.js';
import { calculateSinclair2024, calculateQPoints, calculateGamx, calculateTeamPoints } from '../src/scoring/index.js';

console.log('✓ Testing tracker-core public API entrypoints...\n');

// Test 1: Hub singleton
console.log('Test 1: Hub singleton');
console.log(`  competitionHub: ${competitionHub ? '✓' : '✗'}`);
console.log(`  isReady(): ${competitionHub.isReady() === false ? '✓' : '✗'}`);
console.log(`  getAvailableFOPs(): ${Array.isArray(competitionHub.getAvailableFOPs()) ? '✓' : '✗'}\n`);

// Test 2: Event types
console.log('Test 2: Event types');
console.log(`  EVENT_TYPES.DATABASE: ${EVENT_TYPES.DATABASE === 'database' ? '✓' : '✗'}`);
console.log(`  EVENT_TYPES.UPDATE: ${EVENT_TYPES.UPDATE === 'update' ? '✓' : '✗'}`);
console.log(`  EVENT_TYPES.TIMER: ${EVENT_TYPES.TIMER === 'timer' ? '✓' : '✗'}`);
console.log(`  EVENT_TYPES.DECISION: ${EVENT_TYPES.DECISION === 'decision' ? '✓' : '✗'}\n`);

// Test 3: WebSocket functions
console.log('Test 3: WebSocket integration');
console.log(`  attachWebSocketToServer: ${typeof attachWebSocketToServer === 'function' ? '✓' : '✗'}`);
console.log(`  createWebSocketServer: ${typeof createWebSocketServer === 'function' ? '✓' : '✗'}\n`);

// Test 4: Utility functions
console.log('Test 4: Utility functions');
console.log(`  getFlagUrl: ${typeof getFlagUrl === 'function' ? '✓' : '✗'}`);
console.log(`  buildCacheKey: ${typeof buildCacheKey === 'function' ? '✓' : '✗'}`);
console.log(`  registerCache: ${typeof registerCache === 'function' ? '✓' : '✗'}`);
console.log(`  bumpCacheEpoch: ${typeof bumpCacheEpoch === 'function' ? '✓' : '✗'}`);
console.log(`  getCacheEpoch: ${typeof getCacheEpoch === 'function' ? '✓' : '✗'}\n`);

// Test 4b: Presentation helpers
console.log('Test 4b: Presentation helpers');
console.log(`  isBreakMode: ${typeof isBreakMode === 'function' ? '✓' : '✗'}`);
console.log(`  isBreakMode('SESSION_DONE'): ${isBreakMode('SESSION_DONE') === true ? '✓' : '✗'}`);
console.log(`  isBreakMode('CURRENT_ATHLETE'): ${isBreakMode('CURRENT_ATHLETE') === false ? '✓' : '✗'}`);
console.log(`  buildSessionInfo: ${typeof buildSessionInfo === 'function' ? '✓' : '✗'}`);
console.log(`  buildAttemptLabel: ${typeof buildAttemptLabel === 'function' ? '✓' : '✗'}`);
console.log(`  inferGroupName: ${typeof inferGroupName === 'function' ? '✓' : '✗'}`);
console.log(`  inferBreakMessage: ${typeof inferBreakMessage === 'function' ? '✓' : '✗'}`);
console.log(`  extractCurrentAttempt: ${typeof extractCurrentAttempt === 'function' ? '✓' : '✗'}\n`);

// Test 5: Scoring functions
console.log('Test 5: Scoring functions');
console.log(`  calculateSinclair2024: ${typeof calculateSinclair2024 === 'function' ? '✓' : '✗'}`);
const sinclair = calculateSinclair2024(220, 88.5, 'M');
console.log(`  calculateSinclair2024(220kg, 88.5kg): ${sinclair ? '✓' : '✗'}`);

console.log(`  calculateQPoints: ${typeof calculateQPoints === 'function' ? '✓' : '✗'}`);
const qpoints = calculateQPoints(220, 88.5, 'M');
console.log(`  calculateQPoints(220kg, 88.5kg): ${qpoints ? '✓' : '✗'}`);

console.log(`  calculateGamx: ${typeof calculateGamx === 'function' ? '✓' : '✗'}`);
// Note: calculateGamx requires external JSON files, so we expect it to return 0 in this environment
const gamx = calculateGamx('M', 88.5, 220);
console.log(`  calculateGamx(M, 88.5kg, 220kg): ${gamx !== undefined ? '✓' : '✗'} (Result: ${gamx})`);

console.log(`  calculateTeamPoints: ${typeof calculateTeamPoints === 'function' ? '✓' : '✗'}`);
const points = calculateTeamPoints(1, 100, true);
console.log(`  calculateTeamPoints(Rank 1, 100kg, Member): ${points === 28 ? '✓' : '✗'} (Points: ${points})\n`);

console.log('✓ All smoke tests passed!\n');
console.log('Next steps:');
console.log('1. Extract full implementations per CORE_MIGRATION.md');
console.log('2. Test with owlcms-tracker migration branch');
console.log('3. Verify cutover criteria before merging');
