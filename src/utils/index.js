/**
 * Utility Modules
 * 
 * Exports shared utility functions for:
 * - Flag/logo URL resolution
 * - Cache key generation
 * - Timer and decision state extraction
 * - Attempt bar visibility
 * - Records extraction
 */

// Flag resolver utilities
export { getFlagUrl, getFlagHtml, getLogoUrl, getLogoHtml } from './flag-resolver.js';

// Cache utilities
export { buildCacheKey } from './cache-utils.js';

// Timer and decision helpers
export { extractTimers, extractDecisionState, extractTimerAndDecisionState } from './timer-decision-helpers.js';

// Attempt bar visibility
export { computeAttemptBarVisibility, hasCurrentAthlete } from './attempt-bar-visibility.js';

// Records extraction
export { extractRecordsFromUpdate } from './records-extractor.js';
