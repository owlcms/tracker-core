import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * Learning Mode Utility
 * 
 * Captures all incoming WebSocket messages to the samples/ directory
 * when LEARNING_MODE=true environment variable is set.
 * 
 * Useful for:
 * 1. Understanding OWLCMS data structures
 * 2. Debugging custom scoreboards
 * 3. Creating test data for development
 */

export const LEARNING_MODE = process.env.LEARNING_MODE === 'true';
const SAMPLES_DIR = path.resolve('samples');

// Ensure samples directory exists if enabled
if (LEARNING_MODE) {
  try {
    if (!fs.existsSync(SAMPLES_DIR)) {
      fs.mkdirSync(SAMPLES_DIR, { recursive: true });
      logger.info(`[Learning Mode] Created samples directory: ${SAMPLES_DIR}`);
    }
  } catch (err) {
    logger.error(`[Learning Mode] Failed to create samples directory:`, err);
  }
}

/**
 * Log the current status of Learning Mode
 */
export function logLearningModeStatus() {
  if (LEARNING_MODE) {
    logger.info('==================================================');
    logger.info('🎓 LEARNING MODE ENABLED');
    logger.info(`   All incoming messages will be saved to:`);
    logger.info(`   ${SAMPLES_DIR}`);
    logger.info('==================================================');
  }
}

/**
 * Save a WebSocket message to a file
 * @param {string} type - Message type (update, timer, decision, etc.)
 * @param {Object} data - Parsed message payload
 * @param {string} rawMessage - Original raw string message
 */
export function saveSample(type, data, rawMessage) {
  if (!LEARNING_MODE) return;

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `message-${timestamp}-${type}.json`;
    const filePath = path.join(SAMPLES_DIR, filename);
    
    // Create a rich sample object with metadata
    const sample = {
      meta: {
        timestamp: new Date().toISOString(),
        type,
        size: rawMessage.length
      },
      parsed: data,
      raw: rawMessage
    };
    
    fs.writeFileSync(filePath, JSON.stringify(sample, null, 2));
    // console.log(`[Learning Mode] Saved ${type} sample: ${filename}`);
  } catch (err) {
    logger.error(`[Learning Mode] Failed to save sample:`, err);
  }
}

/**
 * Backwards-compatible capture helper used by websocket-server
 * @param {object} payload - Parsed payload object or raw message wrapper
 * @param {string} rawMessage - Original message string
 * @param {string} reason - Optional reason tag (unused here)
 * @param {string} explicitType - Optional explicit type override
 */
export function captureMessage(payload, rawMessage, reason = '', explicitType = '') {
  if (!LEARNING_MODE) return;

  // Determine type
  const derivedType = explicitType || payload?.type || 'unknown';
  const parsed = payload?.payload ?? payload;
  saveSample(derivedType, parsed, rawMessage);
}
