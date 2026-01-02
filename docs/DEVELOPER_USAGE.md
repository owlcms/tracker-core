# Tracker Core Developer Guide

**Building custom competition applications with OWLCMS**

This guide covers everything from choosing the right development approach to building production-ready applications using the Tracker Core package.

---

## Table of Contents

1. [Developer Scenarios](#developer-scenarios) - Which approach fits your needs?
2. [Installation & Setup](#installation--setup) - Getting started
3. [Quick Start Examples](#quick-start-examples) - Working code
4. [Repository Architecture](#repository-architecture) - Understanding the structure
5. [Troubleshooting](#troubleshooting) - Common issues

---

## Developer Scenarios

### Which Developer Are You?

Choose your scenario to see the recommended setup:

#### Scenario 1: External REST API Developer

**You want to:** Build a custom application (vMix controller, mobile app backend, custom scoreboard service)

**You need:**
- Hub API to read competition data
- WebSocket connection to OWLCMS
- No tracker source code needed

**Recommended approach:** **Install from GitHub**

**Why:** Easiest setup, no need to manage multiple repositories or symlinks.

**Setup (do this):**

```bash
# Create your Express app
mkdir my-vmix-controller
cd my-vmix-controller
npm init -y

# Install tracker-core directly from GitHub
npm install github:owlcms/tracker-core

# Install other dependencies
npm install express
```

---

#### Scenario 2: Tracker Plugin Developer  

**You want to:** Create custom scoreboards for the owlcms-tracker app

**You need:**
- Tracker source code to add plugins to `src/plugins/`
- Hub as a black-box dependency
- No need to modify hub internals

**Recommended approach:** **Clone owlcms-tracker only**

**Why:** The tracker is configured to pull the core library directly from GitHub. You don't need to manually manage the core repository.

**Setup (required to run `npm run dev`):**

```bash
# 1) Get owlcms-tracker
git clone https://github.com/owlcms/owlcms-tracker.git
cd owlcms-tracker

# 2) Install dependencies (includes @owlcms/tracker-core from GitHub)
npm install

# 3) Run the tracker
npm run dev
```

**Create your plugin (same workflow as today):**
- Use an LLM to create a new folder under `src/plugins/<your-plugin>/` following the existing plugin patterns.
- Restart the dev server if the plugin registry requires it.

---

#### Scenario 3: Core Hub/Tracker Developer

**You want to:** Enhance hub API while developing tracker features simultaneously

**You need:**
- Both hub and tracker source code
- Ability to modify hub and test in tracker immediately
- Synchronized commits across both codebases

**Recommended approach:** **Linked development setup**

**Why:** Simple atomic workflow, automatic workspace linking, easier to keep in sync

**Setup (do this):**

```bash
# Clone both repos
git clone https://github.com/owlcms/tracker-core.git
git clone https://github.com/owlcms/owlcms-tracker.git

# Link hub globally
cd tracker-core
npm install
npm link

# Link tracker to use local hub
cd ../owlcms-tracker
npm install
npm link @owlcms/tracker-core

# Run tracker (it will use your local hub)
npm run dev
```

> **Note:** If you run `npm install` (or `npm ci`) in the tracker folder later, npm may replace the symlink with the locked GitHub dependency. If that happens, just run `npm link @owlcms/tracker-core` again to restore your local development link.

**What happens:**
- Tracker SvelteKit app runs on port 8096
- `npm link` creates a symlink: `tracker/node_modules/@owlcms/tracker-core` → `../tracker-core/src`
- When tracker imports `@owlcms/tracker-core`, it reads directly from your hub source folder
- Vite dev server watches the hub folder for file changes
- Edit hub source → Save → Vite detects change → Tracker auto-reloads the affected modules (HMR)
- **You only run the tracker** - hub is a library dependency, not a separate app

**Benefits:**
- ✅ Edit hub source code while tracker is running
- ✅ See hub changes immediately in tracker (HMR reloads)
- ✅ Atomic commits across hub and tracker
- ✅ Test hub changes in real tracker context

---

## Installation & Setup

### Prerequisites

- Node.js 18+ installed
- Basic JavaScript/TypeScript knowledge  
- OWLCMS running and accessible via WebSocket

---

Follow the setup steps in your Scenario above. This section intentionally avoids duplicating those instructions.

---

## Quick Start Examples

**Complete working example** - automatically switches vMix overlays based on competition events (good lift → show video, bad lift → show video, then back to scoreboard).

See [vMix Integration Example](./EXAMPLES.md#vmix-integration-example) in the examples documentation.

---

---

## Additional Usage Examples

### Express.js REST API Server

Build a REST API that exposes competition data:

```javascript
import { competitionHub } from '@owlcms/tracker-core';
import express from 'express';

const app = express();

// Get current lifting order for a FOP
app.get('/api/lifting-order/:fop', (req, res) => {
  const fopUpdate = competitionHub.getFopUpdate({ fopName: req.params.fop });
  const sessionAthletes = competitionHub.getSessionAthletes({ fopName: req.params.fop });
  
  res.json({
    currentAthlete: fopUpdate?.fullName || null,
    athletes: sessionAthletes,
    timer: {
      state: fopUpdate?.athleteTimerEventType,
      remaining: fopUpdate?.athleteMillisRemaining
    }
  });
});

// Get all athletes in database
app.get('/api/athletes', (req, res) => {
  const database = competitionHub.getDatabaseState();
  res.json(database?.athletes || []);
});

app.listen(3000, () => {
  console.log('API server running on port 3000');
});
```

### Next.js API Route

```javascript
// pages/api/scoreboard/[fop].js
import { competitionHub } from '@owlcms/tracker-core';

export default function handler(req, res) {
  const { fop } = req.query;
  
  const fopUpdate = competitionHub.getFopUpdate({ fopName: fop });
  const sessionAthletes = competitionHub.getSessionAthletes({ fopName: fop });
  
  res.status(200).json({
    fop,
    currentAthlete: {
      name: fopUpdate?.fullName,
      weight: fopUpdate?.weight,
      attempt: fopUpdate?.attemptNumber
    },
    athletes: sessionAthletes,
    timestamp: Date.now()
  });
}
```

### CLI Data Export Tool

```javascript
#!/usr/bin/env node
import { competitionHub, EVENT_TYPES } from '@owlcms/tracker-core';
import fs from 'fs';

// Wait for database
competitionHub.on(EVENT_TYPES.DATABASE, () => {
  const database = competitionHub.getDatabaseState();
  
  // Export to JSON
  fs.writeFileSync(
    'competition-export.json',
    JSON.stringify(database, null, 2)
  );
  
  console.log('✓ Competition data exported to competition-export.json');
  console.log(`  Athletes: ${database.athletes?.length || 0}`);
  console.log(`  Teams: ${database.teams?.length || 0}`);
  process.exit(0);
});

console.log('Waiting for OWLCMS database...');
```

---

## API Reference

See [API_REFERENCE.md](./API_REFERENCE.md) for complete API documentation including:

- **Core Hub Methods** (14 methods)
- **Event System** (11 event types)
- **WebSocket Integration** (2 modes)
- **Data Structures** (Database State, FOP Updates, Session Athletes)
- **Utility Modules** (17 modules)



---

## Debugging

### Enable Learning Mode

When developing custom applications, it's helpful to see exactly what data OWLCMS is sending. You can enable "Learning Mode" to capture all incoming WebSocket messages to JSON files.

```bash
# In your consuming app (if it supports this env var)
LEARNING_MODE=true node app.js
```

If you are using `owlcms-tracker`:

```bash
npm run dev:learning
```

Messages are saved to a `samples/` directory with timestamps, allowing you to inspect the exact JSON structure of updates, timer events, and database dumps.

### Check Hub State

You can inspect the internal state of the hub at any time:

```javascript
const state = competitionHub.getDatabaseState();
console.log('Athletes:', state.athletes.length);
console.log('FOPs:', competitionHub.getAvailableFOPs());
```

---

## Troubleshooting

### OWLCMS Not Connecting

1. Check OWLCMS configuration: **Prepare Competition → Connections → URL for Video Data**
2. Ensure URL is `ws://your-server:8096/ws` (not `http://`)
3. Check firewall rules allow WebSocket connections

### Hub Not Receiving Data

```javascript
// Add debug logging
competitionHub.on(EVENT_TYPES.DATABASE, () => {
  console.log('[Debug] Database received');
});

competitionHub.on(EVENT_TYPES.UPDATE, ({ fopName, payload }) => {
  console.log(`[Debug] Update received for ${fopName}:`, payload.uiEvent);
});

```

