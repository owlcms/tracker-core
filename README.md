# Tracker Core

**Node.js package providing a real-time competition hub and WebSocket server integration for OWLCMS.**

Build custom scoreboards, REST APIs, OBS and vMix controllers, and other competition applications using the live data from OWLCMS.   Installs directly from github as a source package.

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

## Documentation

- **[Developer Guide](./docs/DEVELOPER_USAGE.md)** - Installation, setup scenarios, and architecture guide.
- **[Examples](./docs/EXAMPLES.md)** - Code snippets and usage patterns.
  - Minimal Express server setup
  - Real-time data access
  - Event subscriptions (Timer, Decision, etc.)
  - Scoring utilities

- **[API Reference](./docs/API_REFERENCE.md)** - Complete API documentation for Hub methods, events, and utilities.
- **[WebSocket Message Spec](./docs/WEBSOCKET_MESSAGE_SPEC.md)** - Detailed specification of the WebSocket protocol used by OWLCMS.

---

## License

MIT - See LICENSE.txt

---

## Links

- **[owlcms-tracker](https://github.com/owlcms/owlcms-tracker)** - Full scoreboard application using tracker-core
- **[OWLCMS](https://github.com/owlcms/owlcms4)** - Main competition management system
