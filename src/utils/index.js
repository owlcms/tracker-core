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

// Asset resolver utilities (flags, logos, pictures)
export { getFlagUrl, getFlagHtml, getLogoUrl, getLogoHtml, getFlagPath, getPictureUrl, getPictureHtml, getHeaderLogoUrl } from './asset-resolver.js';

// Backward compatibility alias
export { getFlagPath as resolveFlagPath } from './asset-resolver.js';

// Cache utilities
export { buildCacheKey } from './cache-utils.js';

// Timer and decision helpers
export { extractTimers, computeDisplayMode, extractDecisionState, extractTimerAndDecisionState } from './timer-decision-helpers.js';

// Attempt bar visibility
export { computeAttemptBarVisibility, hasCurrentAthlete, logAttemptBarDebug } from './attempt-bar-visibility.js';

// Records extraction
export { extractRecordsFromUpdate } from './records-extractor.js';

// Records display and sorting
export { formatCategoryDisplay, sortRecordsList, sortRecordsByFederation } from './records-display.js';

// Message formatting
export { formatMessage } from './message-format.js';

// Parsing utilities
export { parseFormattedNumber } from './parsing-utils.js';

// Cache registry for coordinated cache invalidation
export { registerCache, unregisterCache, getCacheEpoch, bumpCacheEpoch, getRegisteredCacheCount } from './cache-registry.js';

// Presentation helpers (break messages, session info, attempt labels)
export { 
	isBreakMode, 
	buildSessionInfo, 
	buildAttemptLabel, 
	inferGroupName, 
	inferBreakMessage, 
	extractCurrentAttempt 
} from './presentation-helpers.js';
