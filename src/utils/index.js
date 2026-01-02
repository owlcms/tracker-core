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
export { getFlagUrl, getFlagHtml, getLogoUrl, getLogoHtml, getFlagPath } from './flag-resolver.js';

// Backward compatibility alias
export { getFlagPath as resolveFlagPath } from './flag-resolver.js';

// Cache utilities
export { buildCacheKey } from './cache-utils.js';

// Timer and decision helpers
export { extractTimers, computeDisplayMode, extractDecisionState, extractTimerAndDecisionState } from './timer-decision-helpers.js';

// Attempt bar visibility
export { computeAttemptBarVisibility, hasCurrentAthlete } from './attempt-bar-visibility.js';

// Records extraction
export { extractRecordsFromUpdate } from './records-extractor.js';
