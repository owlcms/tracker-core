/**
 * Tracker Core - Public API entrypoint
 * @owlcms/tracker-core
 * 
 * Exports the competition hub singleton and core types.
 */

import { CompetitionHub } from './competition-hub.js';

// Singleton instance used by all consumers
if (!globalThis.__competitionHub) {
  globalThis.__competitionHub = new CompetitionHub();
}

export const competitionHub = globalThis.__competitionHub;

// Logger facade: defaults to console, pluggable via setLogger
export { logger, setLogger, getLogger } from './utils/logger.js';

// Export binary message handler for WebSocket integration
export { handleBinaryMessage } from './websocket/binary-handler.js';

// Export WebSocket control functions
export { closeConnection, requestResources } from './websocket-server.js';

// Export event types enum
export const EVENT_TYPES = {
  DATABASE: 'database',
  UPDATE: 'update',
  TIMER: 'timer',
  DECISION: 'decision',
  FLAGS_LOADED: 'flags:loaded',
  LOGOS_LOADED: 'logos:loaded',
  TRANSLATIONS_LOADED: 'translations:loaded',
  DATABASE_READY: 'database:ready',
  HUB_READY: 'hub:ready',
  SESSION_DONE: 'session:done',
  SESSION_REOPENED: 'session:reopened'
};

// Re-export utilities for convenience
export { getHeaderLogoUrl, getFlagUrl, getLogoUrl, getPictureUrl } from './utils/asset-resolver.js';
export { formatCategoryDisplay, sortRecordsList } from './utils/records-display.js';
