# Tracker Core (`@owlcms/tracker-core`)

**Node.js package providing a real-time competition hub and WebSocket server integration for OWLCMS.**

Build custom scoreboards, REST APIs, vMix controllers, and other competition applications using the live data from OWLCMS.

---

## What is Tracker Core?

**Tracker Core** is a server-side Node.js package that:

- **Receives live competition data** from OWLCMS via WebSocket
- **Maintains a competition hub** with athlete data, lifting order, scores, rankings, and session state
- **Emits real-time events** that consumers can broadcast to clients (e.g. via SSE, WebSockets, or REST)
- **Provides reusable APIs** for scoring, flag resolution, cache management, timer/decision helpers
- **Supports standalone or attach modes** - works as a standalone HTTP server or plugs into your existing Express/Node application

**Used by:**
- [`owlcms-tracker`](https://github.com/owlcms/owlcms-tracker) - Full-featured competition scoreboard application
- Custom REST APIs and web services
- vMix controllers and live broadcast systems
- Mobile app backends
- CLI tools and data export utilities

---

## Quick Start

### Installation

```bash
npm install @owlcms/tracker-core
```

### Minimal Example

```javascript
import express from 'express';
import { createServer } from 'http';
import { competitionHub, attachWebSocketToServer } from '@owlcms/tracker-core';

const app = express();
const httpServer = createServer(app);

// REST API endpoint
app.get('/api/lifting-order/:fop', (req, res) => {
  const liftingOrder = competitionHub.getLiftingOrderEntries({ fopName: req.params.fop });
  res.json(liftingOrder);
});

// Attach WebSocket handler to existing server
attachWebSocketToServer({
  server: httpServer,
  path: '/ws',
  hub: competitionHub
});

httpServer.listen(8095, () => {
  console.log('Server running on http://localhost:8095');
  console.log('Configure OWLCMS: ws://localhost:8095/ws');
});
```

### Configure OWLCMS

In OWLCMS: **Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://localhost:8095/ws`

---

## Core Features

### Real-Time Data Access

```javascript
import { competitionHub, EVENT_TYPES } from '@owlcms/tracker-core';

// Get current lifter
const current = competitionHub.getCurrentAthlete({ fopName: 'Platform A' });
console.log(`Current: ${current.fullName} - ${current.weight}kg`);

// Get lifting order
const order = competitionHub.getLiftingOrderEntries({ fopName: 'Platform A' });
console.log(`Next 10 athletes:`, order.slice(0, 10));

// Get full database
const db = competitionHub.getDatabaseState();
console.log(`Total athletes: ${db.athletes.length}`);
```

### Event Subscriptions

```javascript
// React to decisions
competitionHub.on(EVENT_TYPES.DECISION, ({ fopName, payload }) => {
  if (payload.decisionEventType === 'FULL_DECISION') {
    const goodCount = [payload.d1, payload.d2, payload.d3].filter(d => d === 'true').length;
    console.log(goodCount >= 2 ? 'GOOD LIFT' : 'NO LIFT');
  }
});

// React to timer events
competitionHub.on(EVENT_TYPES.TIMER, ({ fopName, payload }) => {
  console.log(`Timer: ${payload.athleteMillisRemaining}ms remaining`);
});

// Wait for hub to be ready
competitionHub.once(EVENT_TYPES.HUB_READY, () => {
  console.log('Ready to process queries');
});
```

### Scoring & Utilities

```javascript
import { calculateSinclair2024, getFlagUrl, buildCacheKey } from '@owlcms/tracker-core';

// Calculate scores
const sinclair = calculateSinclair2024({ total: 220, bodyWeight: 88.5, gender: 'M' });
console.log(`Sinclair: ${sinclair}`);

// Get flag URLs
const flagUrl = getFlagUrl({ teamName: 'USA Weightlifting' });
// Returns: "/local/flags/USA Weightlifting.svg"

// Build cache keys
const cacheKey = buildCacheKey({ fopName: 'Platform A', opts: { gender: 'M', topN: 10 } });
```

---

## WebSocket Integration Modes

### Mode 1: Standalone Server (Simple)

```javascript
import { createWebSocketServer } from '@owlcms/tracker-core/websocket';

createWebSocketServer({
  port: 8095,
  path: '/ws',
  hub: competitionHub,
  onConnect: () => console.log('OWLCMS connected'),
  onDisconnect: () => console.log('OWLCMS disconnected')
});
```

### Mode 2: Inject into Existing Server (Recommended for Production)

```javascript
import { attachWebSocketToServer } from '@owlcms/tracker-core/websocket';

attachWebSocketToServer({
  server: myExpressHttpServer,
  path: '/ws',
  hub: competitionHub,
  localFilesDir: '/var/lib/owlcms/local',  // Where to store flags/logos
  localUrlPrefix: '/assets',                // URL prefix for serving files
  onConnect: () => console.log('Connected'),
  onDisconnect: () => console.log('Disconnected')
});
```

---

## Development

### Source Checkout + npm link (Preferred)

```bash
# Clone tracker-core
git clone https://github.com/owlcms/tracker-core.git
cd tracker-core
npm install
npm link

# In your project
npm link @owlcms/tracker-core

# Now /your-project/node_modules/@owlcms/tracker-core is a symlink to tracker-core
```

### Verify Installation

```bash
npm run test:smoke
```

---

## Complete API Reference

See [API_REFERENCE.md](./docs/npm/API_REFERENCE.md) for:

- All hub methods (14 core data access methods)
- Event system and event types
- WebSocket integration APIs
- Utility modules
- Data structure documentation
- Complete examples

---

## Directory Structure

```
tracker-core/
├── src/
│   ├── index.js                    # Public root export
│   ├── competition-hub.js           # Hub singleton
│   ├── websocket-server.js          # WebSocket integration
│   ├── websocket/
│   │   └── index.js                # WebSocket entrypoint
│   ├── utils/
│   │   ├── index.js                # Utils entrypoint
│   │   ├── flag-resolver.js        # Flag/logo URLs
│   │   ├── cache-utils.js          # Cache key building
│   │   ├── timer-decision-helpers.js # Timer extraction
│   │   ├── attempt-bar-visibility.js # Visibility helpers
│   │   └── records-extractor.js    # Record extraction
│   ├── scoring/
│   │   ├── index.js                # Scoring entrypoint
│   │   ├── sinclair-coefficients.js # Sinclair 2020/2024
│   │   ├── qpoints-coefficients.js  # QPoints formula
│   │   ├── gamx2.js                # GAMX scoring
│   │   └── team-points-formula.js  # Team scoring
│   └── protocol/
│       ├── protocol-config.js      # Message format definition
│       ├── parser-v2.js            # V2 message parser
│       ├── binary-handler.js       # ZIP resource extraction
│       └── embedded-database.js    # Database parsing
├── docs/
│   └── npm/
│       ├── API_REFERENCE.md        # Complete API docs
│       ├── DEVELOPER_USAGE.md      # Setup & examples
│       ├── CORE_MIGRATION.md       # Extraction guide
│       └── TRACKER_MIGRATION.md    # Consumer setup
├── tests/
│   └── smoke-test.js               # Minimal verification
├── package.json
└── README.md
```

---

## Publication & Versioning

### Local Development (Recommended)

Use `npm link` for local development - no authentication needed:

```bash
cd tracker-core
npm install
npm link

cd ../your-project
npm link @owlcms/tracker-core
```

### Published Package (Optional)

For CI/production environments, the package can be published to GitHub Packages:

```bash
# In tracker-core/package.json
"publishConfig": {
  "access": "public",
  "registry": "https://npm.pkg.github.com"
}

# Publish via GitHub Actions on tag
npm publish
```

Consumers can then install without authentication (public package):

```bash
npm install @owlcms/tracker-core@^1.0.0
```

---

## Debugging

### Enable Learning Mode

Track all OWLCMS messages:

```bash
# In consuming app
LEARNING_MODE=true node app.js
```

Messages are saved to `samples/message-[timestamp].json`

### Check Hub State

```javascript
const state = competitionHub.getDatabaseState();
console.log(state);
```

### Smoke Test

```bash
npm run test:smoke
```

---

## Contributing

See [REPO_MIGRATION.md](./docs/npm/REPO_MIGRATION.md) and [CORE_MIGRATION.md](./docs/npm/CORE_MIGRATION.md) for architecture and development guidelines.

---

## License

MIT - See LICENSE.txt

---

## Links

- **[owlcms-tracker](https://github.com/owlcms/owlcms-tracker)** - Full scoreboard application using tracker-core
- **[OWLCMS](https://github.com/owlcms/owlcms4)** - Main competition management system
- **[API_REFERENCE.md](./docs/npm/API_REFERENCE.md)** - Complete API documentation
- **[DEVELOPER_USAGE.md](./docs/npm/DEVELOPER_USAGE.md)** - Installation and examples
