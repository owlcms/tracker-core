# Tracker Core API Reference

### Championships (in database state)

```
  championships: Array<{
    name: string,                          // Championship identifier (e.g. "Senior", "U20")
    type: string,                          // ChampionshipType enum (e.g. "IWF", "MASTERS")
    scoringSystem: string | null,          // Primary ranking algorithm
    bestAthleteScoringSystem: string | null,
    bestSnatchScoringSystem: string | null,
    bestCJScoringSystem: string | null,
    snatchCJTotalMedals: boolean,
    teamPoints1st: number | null,
    teamPoints2nd: number | null,
    teamPoints3rd: number | null,
    mensBestN: number | null,              // Top N men to score
    womensBestN: number | null,            // Top N women to score
    mixedMensBestN: number | null,         // Top N men in mixed team
    mixedWomensBestN: number | null,       // Top N women in mixed team
    mixedBestN: number | null,             // Total top N for mixed team
    explicitTeamSize: number | null,       // Fixed team size (or null)
    maxTeamSize: number | null,            // Roster capacity
    maxPerCategory: number | null,         // Max athletes per category per team
    explicitMixedTeamMembers: boolean,     // Require explicit mixed member assignment
    teamScoringSystem: string | null,      // Team ranking algorithm
    mixedTeamScoringSystem: string | null  // Mixed team ranking algorithm
  }>,
  championshipMap: {
    [name: string]: Championship           // Keyed by championship name
  },
```

Field names match the V2 ChampionshipDTO from OWLCMS exactly.
Unknown future fields sent by OWLCMS are preserved via object spread.

**Package:** `@owlcms/tracker-core`

This document provides a complete reference for all APIs exposed by the Tracker Core package.

## Scoring Helpers

The scoring module exports year-aware helpers for Sinclair-style calculations.

```javascript
import {
  calculateSinclair,
  calculateSinclairMasters,
  getMastersAgeFactor,
  normalizeSinclairYear,
  normalizeMastersAgeFactorYear
} from '@owlcms/tracker-core/scoring';
```

- `calculateSinclair(total, bodyWeight, gender, year)` supports `2020`, `2024`, and `2028`.
- `calculateSinclairMasters(total, bodyWeight, gender, age, sinclairYear, ageFactorYear)` supports:
  - base Sinclair years `2020`, `2024`, `2028`
  - masters age-factor years `2020` and `2025`
- `getMastersAgeFactor(age, gender, ageFactorYear)` uses:
  - `2020` for the standard SMF/SMHF table
  - `2025` for the alternate published masters age table
- `normalizeMastersAgeFactorYear(value)` normalizes string or numeric input to `2020` or `2025`.

---

## Table of Contents

1. [Hub Data Access Methods](#hub-data-access-methods)
   - [Core Data Access](#core-data-access) - 14 methods including athlete getters
   - [Less Common Methods](#less-common-methods) - utility methods
   - [WebSocket Callback Methods](#websocket-callback-methods) - connection and resource request wiring
2. [Event System](#event-system)
3. [WebSocket Server Integration](#websocket-server-integration)
4. [Utility Modules](#utility-modules)
5. [Data Structures](#data-structures)

---

## Hub Data Access Methods

The Tracker Core provides methods to access competition state. All methods are available via the hub singleton:

```javascript
import { competitionHub } from '@owlcms/tracker-core';
```

**Quick Reference:**

| Method | Purpose |
|--------|---------|
| `getDatabaseState()` | Full competition data |
| `getFopUpdate({ fopName })` | Latest FOP state (includes athlete keys) |
| `getCurrentAthlete({ fopName })` | Current lifter (no array scanning) ⭐ |
| `getNextAthlete({ fopName })` | Next lifter (no array scanning) ⭐ |
| `getPreviousAthlete({ fopName })` | Previous lifter (no array scanning) ⭐ |
| `getSessionAthletes({ fopName, includeSpacer })` | All session athletes |
| `getStartOrderEntries({ fopName, includeSpacer })` | Registration order |
| `getLiftingOrderEntries({ fopName, includeSpacer })` | Lifting queue |
| `getTranslations({ locale })` | Localized strings |
| `getSessionStatus({ fopName })` | Session complete/active |
| `getTeamNameById({ teamId })` | Resolve team names |
| `isReady()` | Hub initialization check |
| `getFopStateVersion({ fopName })` | Cache invalidation version |
| `getCategoryToAgeGroupMap()` | Category grouping |
| `getLocalUrlPrefix()` | Current local assets URL prefix |
| `setLocalUrlPrefix({ prefix })` | Configure local assets URL prefix |
| `getLocalFilesDir()` | Current local assets base directory |
| `setLocalFilesDir({ localFilesDir })` | Configure local assets base directory |
| `setLogger(logger)` | Inject custom logger (defaults to console) |
| `logger` | Logger facade with error/warn/info/debug/trace/log(level, ...) |
| `setRequestResourcesCallback(fn)` | Inject WebSocket resource request callback |
| `requestPluginPreconditions(missing, timeout)` | Request resources and wait for delivery |
| `lastDatabaseLoad` | Timestamp of last database load (for freshness checks) |

**Local assets URL prefix (`localUrlPrefix`)**

The tracker serves OWLCMS-delivered local assets (flags, logos, pictures, styles) under a URL prefix.

- Default: `/local`
- Configurable: e.g. `/assets`, `/media`, `/tracker-local`

All URL-producing helpers (e.g., `getFlagUrl`, `getLogoUrl`, `getFlagUrl()` utility) must honor this prefix.

**Local assets base directory (`localFilesDir`)**

The tracker writes OWLCMS-delivered ZIP contents under a configurable base directory on disk.

- Default: `<process.cwd()>/local`
- Configurable via `setLocalFilesDir({ localFilesDir })` or websocket options
- Subdirectories: `flags/`, `logos/`, `pictures/`, `styles/`

Helpers such as `getFlagUrl` and the binary ZIP handlers derive their filesystem paths from this base directory.

### Core Data Access

#### `getDatabaseState()`

Returns the complete competition database received from OWLCMS.

**Returns:** `Object | null`

```javascript
const db = competitionHub.getDatabaseState();
// {
//   competition: { name, mensTeamSize, womensTeamSize, sinclair, fops },
//   athletes: [...],
//   teams: [...],
//   ageGroups: [...],
//   records: [...],
//   databaseChecksum: "...",
//   initialized: true
// }
```

**Usage:** Use for global competition data, athlete lists, team information.

---

#### `getFopUpdate({ fopName })`

Returns the latest update payload for a specific FOP (Field of Play).

**Parameters:**
- `fopName` (string) - FOP identifier (e.g., "Platform A", "A")

**Returns:** `Object | null`

```javascript
const fopData = competitionHub.getFopUpdate({ fopName: 'Platform A' });
// {
//   competitionName: "2025 Nationals",
//   fopName: "Platform A",
//   currentAthleteKey: "123",       // Direct key - no scanning needed!
//   nextAthleteKey: "124",          // Direct key - no scanning needed!
//   previousAthleteKey: "122",      // Direct key (may not always be present)
//   fullName: "DOE, John",
//   teamName: "USA Weightlifting",
//   sessionAthletes: [...],
//   startOrderAthletes: [...],
//   liftingOrderAthletes: [...],
//   athleteTimerEventType: "StartTime",
//   athleteMillisRemaining: 60000,
//   // ... etc
// }
```

**Direct access to current/next/previous:**
- `fopUpdate.currentAthleteKey` - Key of current lifter (use to find in arrays or call `getCurrentAthlete()`)
- `fopUpdate.nextAthleteKey` - Key of next lifter (use to find in arrays or call `getNextAthlete()`)
- `fopUpdate.previousAthleteKey` - Key of previous lifter (may be undefined, use `getPreviousAthlete()` for fallback)

**Key-based ordering (advanced):**
- `fopUpdate.startOrderKeys` - Array of athlete keys in registration order (includes category spacers as `{isSpacer: true}`)
- `fopUpdate.liftingOrderKeys` - Array of athlete keys in lifting order (includes lift type spacers)

The hub provides two views:
1. **Key arrays** (`startOrderKeys`, `liftingOrderKeys`) - Lightweight references to athletes
2. **Resolved arrays** (`startOrderAthletes`, `liftingOrderAthletes`) - Full athlete objects with display fields

Use `getStartOrderEntries()` / `getLiftingOrderEntries()` to get resolved arrays with optional spacers.

**Usage:** Primary data source for scoreboard plugins, contains precomputed session data.

---

#### `getSessionAthletes({ fopName, includeSpacer })`

Returns flattened array of athletes in current session with display-ready fields.

**Parameters:**
- `fopName` (string) - FOP identifier
- `includeSpacer` (boolean, optional) - Include category spacer rows (default: false)

**Returns:** `Array<Object>`

```javascript
const athletes = competitionHub.getSessionAthletes({ fopName: 'Platform A' });
// [
//   {
//     key: "123",
//     fullName: "DOE, John",
//     teamName: "USA Weightlifting",
//     categoryName: "M89 Senior",
//     sattempts: [{value: 100, status: "good"}, ...],
//     cattempts: [{value: 120, status: "current"}, ...],
//     bestSnatch: "100",
//     bestCleanJerk: "120",
//     total: "220",
//     classname: "current blink",
//     flagURL: "/local/flags/USA.svg", // URL path (default localUrlPrefix="/local")
//     ...
//   }
// ]
```

**Usage:** Display athlete lists with all precomputed fields from OWLCMS.

---

#### `getCurrentAthlete({ fopName })`

Returns the current athlete on the platform with enriched data (no array scanning needed).

**Parameters:**
- `fopName` (string) - FOP identifier (default: 'A')

**Returns:** `Object | null`

```javascript
const current = competitionHub.getCurrentAthlete({ fopName: 'Platform A' });
// {
//   key: "123",
//   fullName: "DOE, John",
//   teamName: "USA Weightlifting",
//   categoryName: "M89 Senior",
//   sattempts: [...],
//   cattempts: [{value: 120, status: "current"}, ...],
//   total: "100",
//   sinclair: "285.432",
//   classname: "current blink",
//   currentWeight: 120,
//   currentAttempt: "1/6",
//   currentLiftType: "CLEANJERK",
//   ...
// }
```

**Usage:** Get current lifter without scanning `getSessionAthletes()` array.

---

#### `getNextAthlete({ fopName })`

Returns the next athlete in lifting order (no array scanning needed).

**Parameters:**
- `fopName` (string) - FOP identifier (default: 'A')

**Returns:** `Object | null`

```javascript
const next = competitionHub.getNextAthlete({ fopName: 'Platform A' });
// {
//   key: "124",
//   fullName: "SMITH, Jane",
//   teamName: "CAN Weightlifting",
//   currentWeight: 95,
//   currentAttempt: "2/6",
//   currentLiftType: "SNATCH",
//   ...
// }
```

**Usage:** Display "On Deck" athlete without array scanning.

---

#### `getPreviousAthlete({ fopName })`

Returns the previous athlete who lifted (no array scanning needed).

**Parameters:**
- `fopName` (string) - FOP identifier (default: 'A')

**Returns:** `Object | null`

```javascript
const previous = competitionHub.getPreviousAthlete({ fopName: 'Platform A' });
// {
//   key: "122",
//   fullName: "JONES, Bob",
//   teamName: "GBR Weightlifting",
//   currentWeight: 110,
//   currentAttempt: "3/6",
//   currentLiftType: "SNATCH",
//   ...
// }
```

**Usage:** Display last lifter or replay context without array scanning.

**Note:** All three methods (`getCurrentAthlete`, `getNextAthlete`, `getPreviousAthlete`) return enriched athlete objects with:
- `currentWeight` - The weight being attempted/requested
- `currentAttempt` - Attempt number as formatted string (e.g., "1/6", "4/6")
- `currentLiftType` - "SNATCH" or "CLEANJERK"
- Plus all standard session athlete fields (name, team, attempts, totals, rankings, etc.)

---

#### `getStartOrderEntries({ fopName, includeSpacer })`

Returns athletes in registration/start order (sorted by lot number).

**Parameters:**
- `fopName` (string) - FOP identifier
- `includeSpacer` (boolean, optional) - Include category spacer rows (default: false)

**Returns:** `Array<Object>`

```javascript
const startOrder = competitionHub.getStartOrderEntries({
  fopName: 'Platform A',
  includeSpacer: true
});
// [
//   { fullName: "M89 Senior", isSpacer: true, categoryName: "M89 Senior" },
//   { key: "123", fullName: "DOE, John", ... },
//   { key: "124", fullName: "SMITH, Jane", ... },
//   { fullName: "M96 Senior", isSpacer: true, categoryName: "M96 Senior" },
//   ...
// ]
```

**Usage:** Display registration order with optional category headers.

---

#### `getLiftingOrderEntries({ fopName, includeSpacer })`

Returns athletes in lifting order (sorted by next attempt weight).

**Parameters:**
- `fopName` (string) - FOP identifier
- `includeSpacer` (boolean, optional) - Include lift type spacer rows (default: false)

**Returns:** `Array<Object>`

```javascript
const liftingOrder = competitionHub.getLiftingOrderEntries({
  fopName: 'Platform A',
  includeSpacer: true
});
// [
//   { fullName: "Snatch", isSpacer: true, className: "snatch-spacer" },
//   { key: "123", fullName: "DOE, John", classname: "current blink", ... },
//   { key: "125", fullName: "JONES, Bob", classname: "next", ... },
//   { fullName: "Clean & Jerk", isSpacer: true, className: "cleanjerk-spacer" },
//   ...
// ]
```

**Usage:** Display lifting order with current/next athlete highlighting.

---

#### `getTranslations({ locale })`

Returns translation map for specified locale with fallback chain.

**Parameters:**
- `locale` (string) - Locale code (e.g., "en", "fr", "fr-CA")

**Returns:** `Object`

```javascript
const t = competitionHub.getTranslations({ locale: 'fr-CA' });
// {
//   "Start": "Démarrer",    // fr-CA override
//   "Stop": "Arrêter",      // Fallback from "fr"
//   "Athlete": "Athlète",
//   ...
// }
```

**Fallback logic:**
- `"fr-CA"` → Merge `"fr"` base + `"fr-CA"` overrides
- `"en-GB"` → Merge `"en"` base + `"en-GB"` overrides
- `"en"` → Base locale, no merge

**Usage:** Localize scoreboard labels and UI text.

---

#### `getSessionStatus({ fopName })`

Returns session completion status for a FOP.

**Parameters:**
- `fopName` (string) - FOP identifier

**Returns:** `Object`

```javascript
const status = competitionHub.getSessionStatus({ fopName: 'Platform A' });
// {
//   isDone: false,
//   sessionName: "Session 1",
//   lastActivity: 1735689600000
// }
```

**Session lifecycle:**
- `isDone: false` - Session in progress
- `isDone: true` - Session completed (received `GroupDone` event)
- **Reopens automatically** when any new event arrives (timer, decision, update)

**Usage:** Show "Session Complete" message or final results.

---

#### `getTeamNameById({ teamId })`

Resolves team name from numeric team ID.

**Parameters:**
- `teamId` (number) - Team ID from athlete.team field

**Returns:** `string | null`

```javascript
const teamName = competitionHub.getTeamNameById({ teamId: 12345 });
// "USA Weightlifting"
```

**Usage:** Convert athlete's numeric team ID to display name.

---

#### `isReady()`

Checks if hub has received minimum required data (database + translations).

**Returns:** `boolean`

```javascript
if (competitionHub.isReady()) {
  // Safe to process queries
  const athletes = competitionHub.getDatabaseState().athletes;
}
```

**Usage:** Wait for hub initialization before accessing data.

---

#### `getFopStateVersion({ fopName })`

Returns version number for FOP state, increments on every relevant message.

**Parameters:**
- `fopName` (string) - FOP identifier

**Returns:** `number`

```javascript
const version = competitionHub.getFopStateVersion({ fopName: 'Platform A' });
// 42

// Use in cache keys
const cacheKey = `${fopName}-v${version}-${gender}-${topN}`;
```

**Increments on:**
- `type="update"` - Lifting order changes, athlete switches
- `type="timer"` - Timer start/stop/set
- `type="decision"` - Referee decisions
- `type="database"` - Full database reload

**Usage:** Cache invalidation - plugin checks version in cache key to detect stale data.

---

#### `getCategoryToAgeGroupMap()`

Returns map of category codes to age group codes.

**Returns:** `Map<string, string>`

```javascript
const catMap = competitionHub.getCategoryToAgeGroupMap();
catMap.get('SR_M89'); // "SR" (Senior)
catMap.get('YTH_F64'); // "YTH" (Youth)
```

**Usage:** Filter athletes by age group, group categories in results.

---

### Less Common Methods

#### `getAvailableFOPs()`

Returns list of all known FOP names.

**Returns:** `Array<string>`

```javascript
const fops = competitionHub.getAvailableFOPs();
// ["Platform A", "Platform B", "Platform C"]
```

**Usage:** Populate FOP selector dropdowns.

---

#### `getFlagUrl({ teamName })`

Returns a browser-consumable **URL path** to the team flag image (if available).

Notes:
- This is a URL path you can put directly in an `<img src>`.
- It is **not** a local filesystem path.
- The returned URL is rooted at the configured `localUrlPrefix` (default: `/local`).
- For backward compatibility, `getFlagPath({ teamName })` is an alias of `getFlagUrl({ teamName })`.

**Parameters:**
- `teamName` (string) - Team/country name

**Returns:** `string | null`

```javascript
const flagUrl = competitionHub.getFlagUrl({ teamName: 'USA Weightlifting' });
// "/local/flags/USA Weightlifting.svg"
```

**Usage:** Display team flags in scoreboards.

---

#### `getLogoUrl({ teamName })`

Returns a browser-consumable **URL path** to the team logo image (if available).

Notes:
- This is a URL path you can put directly in an `<img src>`.
- It is **not** a local filesystem path.
- The returned URL is rooted at the configured `localUrlPrefix` (default: `/local`).
- For backward compatibility, `getLogoPath({ teamName })` is an alias of `getLogoUrl({ teamName })`.

---

#### `getLocalUrlPrefix()`

Returns the currently configured URL prefix under which local assets are served.

**Returns:** `string`

```javascript
const prefix = competitionHub.getLocalUrlPrefix();
// "/local" (default)
```

---

#### `setLocalUrlPrefix({ prefix })`

Configures the URL prefix under which local assets are served.

**Parameters:**
- `prefix` (string) - Must start with `/` (e.g., `/local`, `/assets`)

```javascript
competitionHub.setLocalUrlPrefix({ prefix: '/assets' });

// Now URL helpers return:
competitionHub.getFlagUrl({ teamName: 'USA Weightlifting' });
// "/assets/flags/USA Weightlifting.svg"
```

---

#### `getLocalFilesDir()`

Returns the currently configured base directory on disk where OWLCMS ZIP payloads are extracted.

**Returns:** `string`

```javascript
const baseDir = competitionHub.getLocalFilesDir();
// "<cwd>/local" (default)
```

---

#### `setLocalFilesDir({ localFilesDir })`

Configures the base directory on disk where OWLCMS ZIP payloads are extracted.

**Parameters:**
- `localFilesDir` (string) - Absolute or relative path to the local assets directory (e.g., `/var/data/tracker-local`)

```javascript
competitionHub.setLocalFilesDir({ localFilesDir: '/var/data/tracker-local' });

// ZIP extractions will write to:
//   /var/data/tracker-local/flags
//   /var/data/tracker-local/logos
//   /var/data/tracker-local/pictures
//   /var/data/tracker-local/styles
```

**Note:** URL helpers (`getFlagUrl`, `getLogoUrl`) derive their filesystem lookups from this base directory and still emit URLs using the configured `localUrlPrefix`.

---

### WebSocket Callback Methods

These methods wire the hub to the WebSocket layer. They are called automatically by `attachWebSocketToServer()` during initialization — you only need these if building a custom WebSocket integration.

#### `setRequestResourcesCallback(callback)`

Injects a function that sends 428-style precondition requests to OWLCMS over the active WebSocket connection. Called once during `attachWebSocketToServer()` initialization.

**Parameters:**
- `callback` (Function) - `(resources: string[]) => boolean` — sends a resource request, returns `true` if sent

```javascript
// Normally called automatically by attachWebSocketToServer().
// Only use directly if building a custom WebSocket transport:
competitionHub.setRequestResourcesCallback((resources) => {
  myWebSocket.send(JSON.stringify({ status: 428, missing: resources }));
  return true;
});
```

---

#### `requestPluginPreconditions(missing, timeoutMs)`

Requests resources from OWLCMS and waits for their delivery (via `flags_loaded`, `logos_loaded`, etc. events). Uses the callback injected by `setRequestResourcesCallback()`.

**Parameters:**
- `missing` (Array<string>) - Resource types to request (e.g., `['flags_zip', 'logos_zip']`)
- `timeoutMs` (number, default 30000) - Maximum wait time

**Returns:** `Promise<boolean>` — `true` if all resources loaded, `false` on timeout

```javascript
const loaded = await competitionHub.requestPluginPreconditions(['flags_zip', 'logos_zip'], 10000);
if (!loaded) {
  console.warn('Some resources did not arrive in time');
}
```

---

#### `lastDatabaseLoad`

Timestamp (`Date.now()`) of the most recent database load. Used by document generators to detect whether a fresh database has arrived after requesting a refresh.

**Type:** `number` (epoch ms)

```javascript
const baseline = competitionHub.lastDatabaseLoad;
// ... request refresh ...
if (competitionHub.lastDatabaseLoad > baseline) {
  console.log('Fresh database received');
}
```

---

#### Logging (`setLogger`, `logger`)

Tracker-core exposes a lightweight, pluggable logger facade. By default it forwards to `console` but you can inject any logger with the usual severity methods (`error`, `warn`, `info`, `debug`, `trace`).

**Set a custom logger:**

```javascript
import { setLogger } from '@owlcms/tracker-core';

setLogger(myLogger); // myLogger should implement error/warn/info/debug/trace
```

**Use the logger facade directly:**

```javascript
import { logger } from '@owlcms/tracker-core';

logger.info('Starting tracker-core');
logger.error('Problem loading data');
logger.log('debug', 'Optional level-based call');
```

**Defaults:** If no logger is provided, tracker-core uses the built-in console. The facade also patches `console.*` to route through the current logger so existing console calls follow the injected backend.

---

## Event System

The Tracker Core extends `EventEmitter` to broadcast competition events. Subscribe to events for reactive workflows (e.g., video switching, live graphics updates).

### Event Types

```javascript
import { EVENT_TYPES } from '@owlcms/tracker-core';
```

| Event Type | When Emitted | Payload |
|------------|--------------|---------|
| `EVENT_TYPES.DATABASE` | Full database received | `(databaseState)` |
| `EVENT_TYPES.UPDATE` | Lifting order/athlete change | `({ fopName, payload })` |
| `EVENT_TYPES.TIMER` | Timer start/stop/set | `({ fopName, payload })` |
| `EVENT_TYPES.DECISION` | Referee decision | `({ fopName, payload })` |
| `EVENT_TYPES.FLAGS_LOADED` | Flag images extracted | `(flagCount)` |
| `EVENT_TYPES.LOGOS_LOADED` | Logo images extracted | `(logoCount)` |
| `EVENT_TYPES.TRANSLATIONS_LOADED` | Translations loaded | `(localeCount)` |
| `EVENT_TYPES.DATABASE_READY` | Database initialized | `()` |
| `EVENT_TYPES.HUB_READY` | Hub fully initialized (database + translations) | `()` |
| `EVENT_TYPES.SESSION_DONE` | Session completed | `({ fopName, sessionName })` |
| `EVENT_TYPES.SESSION_REOPENED` | Session resumed after completion | `({ fopName, sessionName })` |

### Event Subscription

```javascript
import { competitionHub, EVENT_TYPES } from '@owlcms/tracker-core';

// One-time events
competitionHub.once(EVENT_TYPES.HUB_READY, () => {
  console.log('Hub initialized - safe to process queries');
});

// Recurring events
competitionHub.on(EVENT_TYPES.DECISION, ({ fopName, payload }) => {
  console.log(`Decision on ${fopName}: ${payload.decisionEventType}`);
  
  if (payload.decisionEventType === 'FULL_DECISION') {
    const goodCount = [payload.d1, payload.d2, payload.d3]
      .filter(d => d === 'true')
      .length;
    
    const isGoodLift = goodCount >= 2;
    console.log(isGoodLift ? 'Good lift!' : 'No lift');
  }
});

competitionHub.on(EVENT_TYPES.UPDATE, ({ fopName, payload }) => {
  if (payload.uiEvent === 'LiftingOrderUpdated') {
    console.log(`New current athlete: ${payload.fullName}`);
  }
});

competitionHub.on(EVENT_TYPES.TIMER, (fopName, payload) => {
  if (payload.athleteTimerEventType === 'StartTime') {
    console.log(`Timer started: ${payload.athleteMillisRemaining}ms`);
  }
});

competitionHub.on(EVENT_TYPES.SESSION_DONE, (fopName, sessionName) => {
  console.log(`Session "${sessionName}" on ${fopName} is complete`);
});
```

### Event Payload Examples

#### UPDATE Event Payload

```javascript
{
  uiEvent: "LiftingOrderUpdated",
  fopName: "Platform A",
  competitionName: "2025 Nationals",
  currentAthleteKey: "123",
  nextAthleteKey: "124",
  fullName: "DOE, John",
  teamName: "USA Weightlifting",
  attemptNumber: 2,
  weight: 120,
  sessionAthletes: [...],
  startOrderAthletes: [...],
  liftingOrderAthletes: [...]
}
```

#### TIMER Event Payload

```javascript
{
  fopName: "Platform A",
  athleteTimerEventType: "StartTime",  // "StartTime" | "StopTime" | "SetTime"
  athleteMillisRemaining: 60000,
  athleteStartTimeMillis: 1735689600000,
  timeAllowed: 60000,
  breakTimerEventType: null,  // Break timer (if active)
  breakMillisRemaining: 0,
  serverLocalTime: "14:23:45.123"
}
```

#### DECISION Event Payload

```javascript
{
  fopName: "Platform A",
  decisionEventType: "FULL_DECISION",  // "FULL_DECISION" | "DOWN_SIGNAL" | "RESET"
  fullName: "DOE, John",
  attemptNumber: 2,
  d1: "true",   // Referee 1: "true" | "false" | null
  d2: "true",   // Referee 2
  d3: "false",  // Referee 3
  decisionsVisible: "true",
  down: "true"
}
```

---

## WebSocket Server Integration

The hub package includes WebSocket server functionality to receive messages from OWLCMS. Two integration modes are supported:

### Mode 1: Standalone WebSocket Server

Creates its own HTTP server for WebSocket connections.

```javascript
import { competitionHub } from '@owlcms/tracker-core';
import { createWebSocketServer } from '@owlcms/tracker-core/websocket';

createWebSocketServer({
  port: 8095,
  path: '/ws',
  hub: competitionHub,
  onConnect: (ws) => {
    console.log('[WebSocket] OWLCMS connected');
  },
  onDisconnect: () => {
    console.log('[WebSocket] OWLCMS disconnected');
  },
  onMessage: (message) => {
    console.log('[WebSocket] Received:', message.type);
  },
  onError: (error) => {
    console.error('[WebSocket] Error:', error);
  }
});

console.log('WebSocket server listening on ws://localhost:8095/ws');
```

**Use case:** Simple standalone applications, CLI tools, testing.

---

### Mode 2: Inject into Existing HTTP Server (Recommended)

Attach WebSocket handler to an existing Express/HTTP server.

```javascript
import express from 'express';
import { createServer } from 'http';
import { competitionHub } from '@owlcms/tracker-core';
import { attachWebSocketToServer } from '@owlcms/tracker-core/websocket';

const app = express();
const httpServer = createServer(app);

// Your Express routes
app.get('/api/athletes', (req, res) => {
  const db = competitionHub.getDatabaseState();
  res.json(db?.athletes || []);
});

app.get('/api/lifting-order/:fop', (req, res) => {
  const fopData = competitionHub.getFopUpdate({ fopName: req.params.fop });
  const liftingOrder = competitionHub.getLiftingOrderEntries({ fopName: req.params.fop });
  res.json({
    currentAthlete: fopData?.fullName,
    athletes: liftingOrder
  });
});

// Attach WebSocket handler to existing server
attachWebSocketToServer({
  server: httpServer,
  path: '/ws',
  hub: competitionHub,
  onConnect: () => console.log('[WebSocket] OWLCMS connected'),
  onDisconnect: () => console.log('[WebSocket] OWLCMS disconnected')
});

httpServer.listen(8095, () => {
  console.log('HTTP server: http://localhost:8095');
  console.log('WebSocket: ws://localhost:8095/ws');
});
```

**Use case:** Production applications, custom REST APIs, multi-protocol servers.

---

### WebSocket Refresh Helpers

These helpers send a 428-style precondition request back to OWLCMS over the
active WebSocket connection.

#### `requestDatabaseRefresh()`

Requests a fresh `database_zip` payload from OWLCMS.

```javascript
import { competitionHub, requestDatabaseRefresh } from '@owlcms/tracker-core';

const requested = requestDatabaseRefresh();
if (requested) {
  await competitionHub.waitForDatabase();
}
```

**Returns:** `boolean`

- `true` if the request was sent on an active OWLCMS connection
- `false` if no active OWLCMS WebSocket connection exists

**Use case:** Document generators or reports that need a full, current database
before rendering.

#### `requestResources(resources)`

Requests optional ZIP resources such as flags, logos, or pictures.

```javascript
import { requestResources } from '@owlcms/tracker-core';

requestResources(['flags_zip', 'logos_zip']);
```

**Returns:** `boolean`

#### `closeConnection()`

Closes the active OWLCMS connection to force a reconnect and full startup sync.

```javascript
import { closeConnection } from '@owlcms/tracker-core';

closeConnection();
```

**Returns:** `boolean`

---

### WebSocket Configuration Options

Both `createWebSocketServer` and `attachWebSocketToServer` accept these options:

```javascript
{
  // Required
  hub: competitionHub,           // Hub instance to forward messages to

  // Local files output (recommended for production)
  // Where OWLCMS-delivered ZIP resources are written:
  //   - flags_zip  -> <localFilesDir>/flags
  //   - logos_zip  -> <localFilesDir>/logos
  //   - pictures_zip -> <localFilesDir>/pictures
  //   - styles     -> <localFilesDir>/styles
  // The consumer must serve these files at URL path: <localUrlPrefix>/*
  // Default (if omitted): path.join(process.cwd(), 'local')
  localFilesDir: '/var/lib/owlcms-tracker/local',

  // The URL prefix under which the extracted local files are served.
  // Default: '/local'
  // Example: '/assets' -> clients use '/assets/flags/...', '/assets/logos/...'
  localUrlPrefix: '/local',
  
  // Optional
  port: 8095,                    // Port (standalone mode only)
  path: '/ws',                   // WebSocket path (default: '/ws')
  server: httpServer,            // HTTP server (inject mode only)
  
  // Callbacks
  onConnect: (ws) => {},         // Called when OWLCMS connects
  onDisconnect: () => {},        // Called when OWLCMS disconnects
  onMessage: (message) => {},    // Called on every message (after hub processing)
  onError: (error) => {},        // Called on WebSocket errors
  
  // Advanced
  verifyClient: (info, cb) => {} // Custom connection verification
}
```

---

### Architecture Note: Hub Singleton and Connection Ownership

When `attachWebSocketToServer()` (or `createWebSocketServer()`) runs, two things happen internally:

1. An `activeConnection` variable is set when OWLCMS connects over WebSocket.
2. The `requestResources` function (which has closure over `activeConnection`) is injected into the hub via `hub.setRequestResourcesCallback(requestResources)`.

The hub is a **`globalThis` singleton** (`globalThis.__competitionHub`), so it is the same object across the entire Node.js process regardless of how modules are loaded or bundled.

**Why this matters:** In environments like Vite, the same `@owlcms/tracker-core` package can be instantiated multiple times — once by `vite.config.js` (Node-level import) and again by SvelteKit SSR (Vite-transformed import). Each instance gets its own `activeConnection`. Only the instance that runs `attachWebSocketToServer()` has the real OWLCMS connection.

**Rule for consumers:** To send messages back to OWLCMS (e.g., requesting a database refresh), **always go through the hub** rather than importing `requestResources` or `requestDatabaseRefresh` directly:

```javascript
// ✅ CORRECT — works in all environments
import { competitionHub } from '@owlcms/tracker-core';

// The hub always holds the callback from the instance that owns the connection
competitionHub._requestResourcesCallback(['database']);

// Or use the public method for plugin preconditions
await competitionHub.requestPluginPreconditions(['flags_zip', 'logos_zip']);
```

```javascript
// ❌ RISKY — may get a different module instance with no active connection
import { requestResources } from '@owlcms/tracker-core';
requestResources(['database']);  // Can fail silently if module was duplicated
```

This is only relevant when tracker-core is used inside a bundler (Vite, Webpack, etc.) that may create multiple module instances. In standalone Node.js scripts, direct imports work fine because there is only one module instance.

---

## Local Files (flags/logos/pictures/styles)

OWLCMS can send ZIP resources (e.g., `flags_zip`, `logos_zip`, `translations_zip`) over the same WebSocket connection.

- The **URL paths** used by clients remain stable under the configured `localUrlPrefix` (default: `/local`).
  - Examples (default): `/local/flags/<name>.svg`, `/local/logos/<name>.png`
  - Examples (custom prefix): `/assets/flags/<name>.svg`, `/assets/logos/<name>.png`
- The **filesystem output directory** for extracted files must be configurable via the WebSocket integration option `localFilesDir`.

This is required so deployments can write to a durable, configurable location (container volume, system service directory, etc.).

---

### OWLCMS Configuration

In OWLCMS, configure the WebSocket URL:

**Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://your-server:8095/ws`

---

## Utility Modules

### Flag Resolver

```javascript
import { getFlagUrl, getFlagHtml } from '@owlcms/tracker-core/utils';

// Get flag URL (returns null if not found)
const flagUrl = getFlagUrl('USA Weightlifting');
// "/local/flags/USA Weightlifting.svg"

// Get flag as HTML img tag
const flagHtml = getFlagHtml({ teamName: 'USA Weightlifting', width: 32, height: 24 });
// '<img src="/local/flags/USA Weightlifting.svg" width="32" height="24" alt="USA Weightlifting" />'
```

---

### Scoring Formulas

**Parameter style (future spec):**

All public scoring functions accept a single object parameter (no positional arguments).

#### Sinclair

```javascript
import { 
	calculateSinclair,
  calculateSinclair2024,
  calculateSinclair2020,
	calculateSinclair2028,
	calculateSinclairMasters,
  getMastersAgeFactor
} from '@owlcms/tracker-core/scoring';

const sinclair2024 = calculateSinclair2024(220, 88.5, 'M');
// 285.432

const sinclair2020 = calculateSinclair2020(220, 88.5, 'M');
// 283.156

const sinclair2028 = calculateSinclair2028(220, 88.5, 'M');
// 279.091

const configurableSinclair = calculateSinclair(220, 88.5, 'M', 2028);
// 279.091

// Masters age adjustment
const ageFactor = getMastersAgeFactor(45, 'M');
const adjustedSinclair = calculateSinclairMasters(220, 88.5, 'M', 45, 2024);

```

---

#### QPoints

```javascript
import { calculateQPoints } from '@owlcms/tracker-core/scoring';

// Preferred object form
const qpoints = calculateQPoints({ total: 220, bodyWeight: 88.5, gender: 'M' });
// 95.234

```

---

#### GAMX

```javascript
import { calculateGamx, Variant } from '@owlcms/tracker-core/scoring';

// Preferred object form
const gamx = calculateGamx({ total: 220, bodyWeight: 88.5, gender: 'M', variant: Variant.GAMX });
// 512.34

const gamx2 = calculateGamx({ total: 220, bodyWeight: 88.5, gender: 'M', variant: Variant.GAMX2 });
// 523.45

```

---

### Team Scoring

```javascript
import { calculateTeamPoints } from '@owlcms/tracker-core/team';

const teamPoints = calculateTeamPoints({
  mensTeamSize: 5,      // Top 5 men count
  womensTeamSize: 5,    // Top 5 women count
  scoringMethod: 'sinclair',  // 'sinclair' | 'qpoints' | 'gamx'
  athletes
});

// Returns: { teamName: totalPoints, ... }
```

---

### Parsing Utilities

```javascript
import { parseFormattedNumber } from '@owlcms/tracker-core/utils';

// Parse numbers with European decimal commas or standard decimals
parseFormattedNumber("123.45");  // → 123.45
parseFormattedNumber("123,45");  // → 123.45 (European format)
parseFormattedNumber(123.45);    // → 123.45
parseFormattedNumber("");        // → 0
parseFormattedNumber("-");       // → 0
parseFormattedNumber(null);      // → 0
```

---

### Cache Utilities

```javascript
import { buildCacheKey } from '@owlcms/tracker-core/utils';

const cacheKey = buildCacheKey({
  fopName: 'Platform A',
  includeFop: true,
  opts: {
    gender: 'M',
    topN: 10,
    sortBy: 'sinclair'
  }
});
// "Platform_A-M-10-sinclair"
```

---

### Cache Registry

Coordinates cache invalidation across plugins. When the epoch is bumped, all registered caches are cleared atomically.

```javascript
import {
  registerCache,
  unregisterCache,
  getCacheEpoch,
  bumpCacheEpoch,
  getRegisteredCacheCount
} from '@owlcms/tracker-core/utils';

// Register a Map-based cache at module load time
const myCache = new Map();
registerCache(myCache);

// Read current epoch (monotonically increasing counter)
const epoch = getCacheEpoch();

// Bump epoch — clears ALL registered caches
const newEpoch = bumpCacheEpoch();

// Check how many caches are registered
const count = getRegisteredCacheCount();

// Unregister on cleanup
unregisterCache(myCache);
```

| Function | Returns | Purpose |
|---|---|---|
| `registerCache(cacheMap)` | `void` | Register a `Map` to be cleared on epoch bump |
| `unregisterCache(cacheMap)` | `void` | Remove a cache from the registry |
| `getCacheEpoch()` | `number` | Current epoch value |
| `bumpCacheEpoch()` | `number` | Increment epoch and clear all registered caches |
| `getRegisteredCacheCount()` | `number` | Number of registered caches |

---

### Timer & Decision Helpers

```javascript
import { 
  extractTimers,
  extractDecisionState,
  extractTimerAndDecisionState
} from '@owlcms/tracker-core/helpers';

const fopUpdate = competitionHub.getFopUpdate({ fopName: 'Platform A' });

// Extract timer states (athlete + break)
const timers = extractTimers(fopUpdate);
// {
//   athlete: { state: "running", timeRemaining: 60000, duration: 60000 },
//   break: { state: "stopped", timeRemaining: 0, duration: 0 }
// }

// Extract decision state
const decision = extractDecisionState(fopUpdate);
// { type: "FULL_DECISION", visible: true }

// Extract both at once
const { timers, decision } = extractTimerAndDecisionState(fopUpdate);
```

---

### Attempt Bar Visibility

```javascript
import { 
  computeAttemptBarVisibility,
  hasCurrentAthlete,
  logAttemptBarDebug
} from '@owlcms/tracker-core/utils';

const fopUpdate = competitionHub.getFopUpdate({ fopName: 'Platform A' });

// Check if attempt bar should be shown
const showAttemptBar = computeAttemptBarVisibility(fopUpdate);
// true if timer running or athlete on platform

// Check if there's a current athlete
const hasCurrent = hasCurrentAthlete(fopUpdate);
// true if currentAthleteKey is set

// Log detailed debug info about attempt bar state (uses logger.debug)
logAttemptBarDebug(fopUpdate);
```

---

### Presentation Helpers

Helpers for scoreboard display: break messages, session info, attempt labels, and current athlete extraction. All functions that need translations accept a `hub` parameter with a `translate(key, locale)` method.

```javascript
import {
  isBreakMode,
  buildSessionInfo,
  buildAttemptLabel,
  inferGroupName,
  inferBreakMessage,
  extractCurrentAttempt
} from '@owlcms/tracker-core/utils';

const fopUpdate = competitionHub.getFopUpdate({ fopName: 'Platform A' });

// Check if current mode is a break
isBreakMode('INTERRUPTION');     // true
isBreakMode('CURRENT_ATHLETE');  // false

// Build session info string: "Session M1 – Snatch"
const sessionInfo = buildSessionInfo(fopUpdate, competitionHub, 'en');

// Build attempt label: "Snatch #2" or "C&J #1"
const attemptLabel = buildAttemptLabel(fopUpdate, competitionHub, 'en');

// Get group name for break display: "Group M1"
const groupName = inferGroupName(fopUpdate, competitionHub, 'en');

// Get break message: "Competition Paused", "Introduction of Athletes", etc.
const breakMsg = inferBreakMessage('TECHNICAL', null, competitionHub, 'en');

// Extract current attempt (or break info) for scoreboard overlays
const current = extractCurrentAttempt(fopUpdate, competitionHub, getFlagUrl, 'en');
// Returns: { fullName, teamName, flagUrl, categoryName, attempt, weight, isBreak, ... }
// Returns null if no current athlete and not in break mode
```

| Function | Parameters | Returns |
|---|---|---|
| `isBreakMode(mode)` | `string` | `boolean` |
| `buildSessionInfo(fopUpdate, hub, locale)` | FOP update, hub with `translate()`, locale | `string` |
| `buildAttemptLabel(fopUpdate, hub, locale)` | FOP update, hub with `translate()`, locale | `string` |
| `inferGroupName(fopUpdate, hub, locale)` | FOP update, hub with `translate()`, locale | `string` |
| `inferBreakMessage(breakType, ceremonyType, hub, locale)` | break type, ceremony type, hub, locale | `string` |
| `extractCurrentAttempt(fopUpdate, hub, getFlagUrl, locale)` | FOP update, hub, flag URL fn, locale | `Object\|null` |

---

### Records Extraction

```javascript
import { extractRecordsFromUpdate } from '@owlcms/tracker-core/records';

const fopUpdate = competitionHub.getFopUpdate({ fopName: 'Platform A' });

// Get new records broken in current session
const newRecords = extractRecordsFromUpdate(fopUpdate);
// [
//   { recordName: "National", recordLift: "SNATCH", recordValue: 125, athleteName: "DOE, John" },
//   ...
// ]
```

---

## Data Structures

### Database State

Complete structure returned by `getDatabaseState()`:

```javascript
{
  competition: {
    name: string,              // Competition name
    mensTeamSize: number,      // Top N athletes for men's team scoring
    womensTeamSize: number,    // Top N athletes for women's team scoring
    sinclair: string,          // Scoring formula: "2020", "2024", etc.
    fops: Array<string>        // FOP names: ["Platform A", "Platform B"]
  },
  athletes: Array<{
    key: string | number,      // Unique athlete identifier (can be negative)
    firstName: string,
    lastName: string,
    fullBirthDate: Array<number> | string,  // [2001, 1, 18] or "2001-01-18"
    gender: "M" | "F",
    bodyWeight: number,
    categoryCode: string,      // e.g., "SR_M89"
    team: number,              // Team ID (resolved via getTeamNameById)
    sessionName: string,
    startNumber: number,
    lotNumber: number,
    // Attempt declarations and results (6 attempts total)
    snatch1Declaration: number,
    snatch1Change1: number | null,
    snatch1Change2: number | null,
    snatch1ActualLift: number | null,  // Positive = good, negative = fail
    snatch1AutomaticProgression: number | null,
    snatch2Declaration: number,
    snatch2Change1: number | null,
    snatch2Change2: number | null,
    snatch2ActualLift: number | null,
    snatch2AutomaticProgression: number | null,
    snatch3Declaration: number,
    snatch3Change1: number | null,
    snatch3Change2: number | null,
    snatch3ActualLift: number | null,
    snatch3AutomaticProgression: number | null,
    cleanJerk1Declaration: number,
    cleanJerk1Change1: number | null,
    cleanJerk1Change2: number | null,
    cleanJerk1ActualLift: number | null,
    cleanJerk1AutomaticProgression: number | null,
    cleanJerk2Declaration: number,
    cleanJerk2Change1: number | null,
    cleanJerk2Change2: number | null,
    cleanJerk2ActualLift: number | null,
    cleanJerk2AutomaticProgression: number | null,
    cleanJerk3Declaration: number,
    cleanJerk3Change1: number | null,
    cleanJerk3Change2: number | null,
    cleanJerk3ActualLift: number | null,
    cleanJerk3AutomaticProgression: number | null,
    total: number,
    sinclair: number,
    participations: Array<{
      categoryCode: string,
      snatchRank: number,
      cleanJerkRank: number,
      totalRank: number,
      teamMember: boolean,
      championshipType: string
    }>
  }>,
  teams: Array<{
    id: number,
    name: string,
    fullName: string,
    code: string
  }>,
  ageGroups: Array<{
    active: boolean,
    code: string,
    name: string,
    categories: Array<{
      code: string,
      categoryCode: string,
      id: number | string
    }>
  }>,
  records: Array<{
    id: number,
    recordValue: number,
    ageGrp: string,
    athleteName: string,
    bwCatLower: number,
    bwCatUpper: number,
    gender: "M" | "F",
    recordFederation: string,
    recordLift: "SNATCH" | "CLEANJERK" | "TOTAL",
    recordName: string,
    bwCatString: string,
    groupNameString: string   // Empty for pre-existing, session name for new records
  }>,
  databaseChecksum: string,
  lastUpdate: number,
  initialized: boolean
}
```

---

### FOP Update

Complete structure returned by `getFopUpdate({ fopName })`:

```javascript
{
  // Competition metadata
  competitionName: string,
  fop: string,                    // FOP name
  fopName: string,                // Alternative field name
  fopState: string,               // "INACTIVE", "CURRENT_ATHLETE", "BREAK", etc.
  sessionName: string,            // Current session/group name
  sessionInfo: string,            // Formatted session details
  
  // Current athlete identifiers (no array scanning needed!)
  currentAthleteKey: string,      // Key of current lifter
  nextAthleteKey: string,         // Key of next lifter
  previousAthleteKey: string,     // Key of previous lifter (may be undefined)
  
  // Current athlete display fields
  fullName: string,
  teamName: string,
  startNumber: number,
  categoryName: string,
  attempt: string,
  attemptNumber: number,
  weight: number,
  
  // Session athletes (flattened array with display-ready fields)
  sessionAthletes: Array<{
    // See "Session Athlete (Display-Ready)" section below
  }>,
  
  // Ordered athlete arrays (resolved with full objects)
  startOrderAthletes: Array<{
    ...athleteFields,
    classname: string,
    isSpacer?: boolean             // Category spacer flag
  }>,
  liftingOrderAthletes: Array<{
    ...athleteFields,
    classname: string,
    isSpacer?: boolean             // Snatch/C&J spacer flag
  }>,
  
  // Key-based ordering (lightweight references)
  startOrderKeys: Array<string | {isSpacer: true, ...}>,
  liftingOrderKeys: Array<string | {isSpacer: true, ...}>,
  
  // Timer state (athlete clock)
  athleteTimerEventType: "StartTime" | "StopTime" | "SetTime",
  athleteMillisRemaining: number,
  athleteStartTimeMillis: number,
  timeAllowed: number,
  
  // Break timer state
  breakTimerEventType: "StartTime" | "StopTime" | "SetTime" | "Pause",
  breakMillisRemaining: number,
  breakStartTimeMillis: number,
  
  // Decision state
  decisionEventType: string,
  decisionsVisible: "true" | "false",
  d1: "true" | "false" | null,
  d2: "true" | "false" | null,
  d3: "true" | "false" | null,
  down: "true" | "false",
  
  // Break/ceremony state
  break: "true" | "false",
  breakType: string,
  ceremonyType: string,
  
  // Records
  records: Array<{ ... }>,       // Same structure as database.records
  
  // Metadata
  lastUpdate: number,
  lastDataUpdate: number,
  uiEvent: string
}
```

---

### Session Athlete (Display-Ready)

Athletes in `sessionAthletes`, `startOrderAthletes`, `liftingOrderAthletes` have these display fields:

```javascript
{
  // Identity
  key: string,
  fullName: "DOE, John",
  firstName: "John",
  lastName: "DOE",
  
  // Team & Category
  teamName: "USA Weightlifting",
  categoryName: "M89 Senior",
  gender: "M",
  
  // Attempts (precomputed by OWLCMS)
  sattempts: [
    { value: 100, status: "good" },
    { value: 105, status: "bad" },
    { value: 105, status: "request" }
  ],
  cattempts: [
    { value: 120, status: "current" },  // Current attempt
    { value: null, status: null },
    { value: null, status: null }
  ],
  
  // Best lifts
  bestSnatch: "100",
  bestCleanJerk: "120",
  total: "220",
  
  // Rankings
  snatchRank: "2",
  cleanJerkRank: "1",
  totalRank: "1",
  sinclair: "285.432",
  sinclairRank: "1",
  
  // Visual state
  classname: "current blink",  // "current blink" | "next" | "good-lift" | "no-lift" | ""
  
  // Flags & branding
  flagURL: "/local/flags/USA Weightlifting.svg",
  flagClass: "longTeam",  // "shortTeam" | "longTeam"
  teamLength: 16
}
```

---

## Complete Usage Example

```javascript
import express from 'express';
import { createServer } from 'http';
import { 
  competitionHub, 
  EVENT_TYPES,
  attachWebSocketToServer 
} from '@owlcms/tracker-core';

const app = express();
const httpServer = createServer(app);

// Wait for hub to be ready
competitionHub.once(EVENT_TYPES.HUB_READY, () => {
  console.log('✓ Hub ready - database and translations loaded');
});

// React to decisions
competitionHub.on(EVENT_TYPES.DECISION, (fopName, payload) => {
  if (payload.decisionEventType === 'FULL_DECISION') {
    const goodCount = [payload.d1, payload.d2, payload.d3]
      .filter(d => d === 'true').length;
    
    console.log(`Decision on ${fopName}: ${goodCount >= 2 ? 'GOOD LIFT' : 'NO LIFT'}`);
  }
});

// REST API endpoints
app.get('/api/lifting-order/:fop', (req, res) => {
  const liftingOrder = competitionHub.getLiftingOrderEntries({
    fopName: req.params.fop,
    includeSpacer: true
  });
  
  res.json({
    fop: req.params.fop,
    athletes: liftingOrder,
    timestamp: Date.now()
  });
});

app.get('/api/athletes', (req, res) => {
  const db = competitionHub.getDatabaseState();
  res.json(db?.athletes || []);
});

// Attach WebSocket handler
attachWebSocketToServer({
  server: httpServer,
  path: '/ws',
  hub: competitionHub,
  onConnect: () => console.log('OWLCMS connected'),
  onDisconnect: () => console.log('OWLCMS disconnected')
});

httpServer.listen(8095, () => {
  console.log('Server ready: http://localhost:8095');
  console.log('Configure OWLCMS: ws://localhost:8095/ws');
});
```

---

## See Also

- [DEVELOPER_USAGE.md](./DEVELOPER_USAGE.md) - Installation and quick start guides
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Package development plan
- [API_ANALYSIS.md](./API_ANALYSIS.md) - Detailed analysis of current plugin patterns
