#!/usr/bin/env node

/**
 * Verify that all required exports are available
 * This script checks that the exports in index files match what consumers need
 */

import * as utils from '../src/utils/index.js';
import * as websocket from '../src/websocket/index.js';
import * as scoring from '../src/scoring/index.js';

const REQUIRED_EXPORTS = {
  utils: [
    'buildCacheKey',
    'resolveFlagPath',
    'getFlagUrl',
    'getFlagHtml',
    'extractTimers',
    'computeDisplayMode',
    'extractDecisionState',
    'extractTimerAndDecisionState'
  ],
  websocket: [
    'attachWebSocketToServer'
  ],
  scoring: [
    // Add scoring exports if needed
  ]
};

let hasErrors = false;

console.log('🔍 Verifying exports...\n');

// Check utils
console.log('📦 Checking @owlcms/tracker-core/utils:');
for (const exportName of REQUIRED_EXPORTS.utils) {
  if (utils[exportName]) {
    console.log(`  ✅ ${exportName}`);
  } else {
    console.log(`  ❌ ${exportName} - MISSING`);
    hasErrors = true;
  }
}

// Check websocket
console.log('\n📦 Checking @owlcms/tracker-core/websocket:');
for (const exportName of REQUIRED_EXPORTS.websocket) {
  if (websocket[exportName]) {
    console.log(`  ✅ ${exportName}`);
  } else {
    console.log(`  ❌ ${exportName} - MISSING`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.log('\n❌ Some exports are missing. Please update the index.js files.');
  process.exit(1);
} else {
  console.log('\n✅ All required exports are available.');
  process.exit(0);
}
