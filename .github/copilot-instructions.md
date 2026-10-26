<!-- markdownlint-disable -->
# 📋 Context for GitHub Copilot: @owlcms/tracker-core Package

You are helping build **tracker-core**, a shared NPM package for Olympic weightlifting competition tracking.

## 📚 Primary Documentation

**READ THESE FIRST** when working on this project:

1. **[README.md](../README.md)** - Package overview & API reference
2. **[docs/migration/CORE_MIGRATION.md](../docs/migration/CORE_MIGRATION.md)** - Migration guide from owlcms-tracker
3. **[docs/DEVELOPER_USAGE.md](../docs/DEVELOPER_USAGE.md)** - How to use this package
4. **[docs/API_REFERENCE.md](../docs/API_REFERENCE.md)** - Complete API documentation

**⚠️ IMPORTANT:** This is a shared library package. Changes here affect multiple consumers (owlcms-tracker, custom implementations, etc.)

## � Agent Rules

**Git Operations:**
- **DO NOT** run `git` commands (commit, push, add, etc.) without explicit user approval.
- You may suggest git commands, but do not execute them automatically.
- Always ask for permission before modifying the repository history or remote state.
- Never add a Copilot `Co-authored-by` trailer to a commit message.

## �🛠️ Development Environment

**Operating System:** Windows with bash shell (Git Bash or WSL)
- When generating terminal commands, use bash syntax
- File paths use Windows format (`c:\Dev\...`) but commands are bash-style
- **Use `grep`, not `rg`** - `ripgrep` is not available, use standard `grep` for searching
- **CRITICAL:** Git Bash has limitations with heredocs - see section below

------

## 🚨 Git Bash Shell Limitations

### DO NOT use heredocs with inline code

**❌ WRONG - This will corrupt files:**
```bash
cat > file.js << 'EOF'
const x = 'value';
EOF
```

**❌ WRONG - Python heredocs also fail:**
```bash
python - <<'PY'
import sys
print("hello")
PY
```

**Why it fails:**
- Git Bash on Windows has issues with heredoc parsing
- Results in corrupted files with mangled content
- Particularly dangerous with search-and-replace operations

### ✅ CORRECT Alternatives

**Option 1: Create external script file first**
```bash
# Create the script file separately
cat > /tmp/script.py
# Then paste content manually or use text editor

# Run it
python /tmp/script.py
```

**Option 2: Use Node.js for simple replacements**
```bash
node -e "
const fs = require('fs');
let text = fs.readFileSync('file.js', 'utf8');
text = text.replace(/oldPattern/g, 'newPattern');
fs.writeFileSync('file.js', text);
"
```

**Option 3: Create .cjs script file (for ESM projects)**
```bash
# Save script to file first
cat > fix_script.cjs
# Add content via editor or create_file tool

# Run it
node fix_script.cjs
```

**Option 4: Use sed for simple replacements**
```bash
# Single replacement (be careful with special characters)
sed -i 's/console\.log(/logger.log(/g' file.js
```

**REMEMBER:** 
- Always prefer creating files via the `create_file` tool
- For complex multi-line scripts, create the file first, then execute
- Test on a backup copy before modifying important files

------

## 🏗️ Package Architecture

```
@owlcms/tracker-core/
├── src/
│   ├── index.js                    # Public API exports
│   ├── competition-hub.js          # Central state management
│   ├── websocket-server.js         # WebSocket message handler
│   ├── protocol/
│   │   ├── parser-v2.js           # Parse OWLCMS messages
│   │   ├── protocol-config.js     # Version validation
│   │   └── embedded-database.js   # Database payload parser
│   ├── scoring/
│   │   ├── index.js               # Scoring exports
│   │   ├── gamx2.js               # GAMX scoring
│   │   ├── qpoints-coefficients.js
│   │   ├── sinclair-coefficients.js
│   │   └── team-points-formula.js
│   ├── utils/
│   │   ├── logger.js              # Pluggable logger facade
│   │   ├── cache-utils.js         # Cache key generation
│   │   ├── flag-resolver.js       # Flag URL helpers
│   │   ├── timer-decision-helpers.js
│   │   ├── attempt-bar-visibility.js
│   │   └── records-extractor.js
│   └── websocket/
│       ├── index.js               # WebSocket exports
│       └── binary-handler.js      # Binary frame processing
└── tests/
    └── smoke-test.js              # API validation tests
```

------

## 🔧 Key Design Principles

### 1. Pluggable Logger System

All logging goes through `logger` facade (NO direct console.* calls):

```javascript
import { logger } from './utils/logger.js';

// Use logger, not console
logger.info('Starting process');
logger.error('Failed:', error.message);
logger.debug('Details:', data);
```

**Consumer can customize:**
```javascript
import { setLogger } from '@owlcms/tracker-core';

setLogger({
  info: (msg) => myLogger.log(msg),
  error: (msg) => myLogger.error(msg),
  // ... etc
});
```

### 2. Dependency Injection

Hub is injected, not imported globally:

```javascript
// ✅ CORRECT
export async function handleBinaryMessage(buffer, hub) {
  const fopUpdate = hub.getFopUpdate(fopName);
}

// ❌ WRONG
import { competitionHub } from './competition-hub.js';
export async function handleBinaryMessage(buffer) {
  const fopUpdate = competitionHub.getFopUpdate(fopName);
}
```

### 3. Pure Functions for Scoring

Scoring functions are stateless:

```javascript
// ✅ CORRECT - Pure function
export function calculateSinclair2024(total, bodyWeight, gender) {
  // No external state, deterministic
  return result;
}
```

------

## 📋 Code Style Guidelines

### Logging Rules

- ✅ Always use `logger.*` instead of `console.*`
- ✅ Import logger at the top: `import { logger } from './utils/logger.js';`
- ✅ Use appropriate levels: error, warn, info, debug, trace
- ❌ Never use `console.log`, `console.error`, etc. directly

### Error Handling

```javascript
try {
  // operation
} catch (error) {
  logger.error('[Component] Operation failed:', error.message);
  // Don't log stack trace unless debugging
}
```

### Module Exports

Use named exports (not default):

```javascript
// ✅ CORRECT
export function calculateScore(x) { }
export const CONSTANTS = { };

// ❌ WRONG
export default function calculateScore(x) { }
```

------

## 🧪 Testing

Run tests before committing:

```bash
npm test
```

All tests must pass. Tests validate:
- Public API exports
- Hub singleton behavior
- WebSocket integration
- Scoring functions
- Utility functions

------

## 📦 Publishing Workflow

**For maintainers only:**

1. Update version in `package.json`
2. Run tests: `npm test`
3. Commit changes
4. Publish: `npm publish --access public`

------

## 🎯 AI-Assisted Development Target

This package is **designed for maintainability**:

1. Clear separation between protocol handling, state management, and utilities
2. Pluggable logger allows custom logging in any environment
3. Comprehensive tests validate API stability
4. Documentation guides consumers on proper usage
