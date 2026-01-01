# Tracker Core (`@owlcms/tracker-core`)

**Node.js package providing a real-time competition hub and WebSocket server integration for OWLCMS.**

Build custom scoreboards, REST APIs, vMix controllers, and other competition applications using the live data from OWLCMS.

---

## What is Tracker Core?

**Tracker Core** is a server-side Node.js package that:

- **Receives live competition data** from OWLCMS via WebSocket
- **Maintains a competition hub** with athlete data, lifting order, scores, rankings, and session state
- **Emits real-time events** that consumers can relay and further broadcast to clients (e.g. via SSE, WebSockets, or REST)
- **Provides reusable APIs** for scoring, flag resolution, cache management, timer/decision helpers
- **Supports standalone or attach modes** - works as a standalone websocket server or plugs into your existing Express/Node application

**Used by:**
- [`owlcms-tracker`](https://github.com/owlcms/owlcms-tracker) - Full-featured competition scoreboard application

---

## Quick Start

### Usage

See [EXAMPLES.md](./docs/EXAMPLES.md) for code examples including:
- Minimal Express server setup
- Real-time data access
- Event subscriptions (Timer, Decision, etc.)
- Scoring utilities
- WebSocket integration modes

## Documentation

- **[API Reference](./docs/npm/API_REFERENCE.md)** - Complete API documentation for Hub methods, events, and utilities.
- **[WebSocket Message Spec](./docs/WEBSOCKET_MESSAGE_SPEC.md)** - Detailed specification of the WebSocket protocol used by OWLCMS.
- **[Examples](./docs/EXAMPLES.md)** - Code snippets and usage patterns.

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
npm run test:core-smoke
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
npm run test:core-smoke
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
