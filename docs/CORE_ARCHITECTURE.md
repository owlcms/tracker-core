# Core Architecture - WebSocket & Competition Hub

## Overview

The **Tracker Core** package (`@owlcms/tracker-core`) is responsible for maintaining the state of the competition by consuming the WebSocket stream from OWLCMS. It acts as the central source of truth for all downstream applications (scoreboards, APIs, etc.).

## Message Processing and Event Emission

The core architecture follows a **Receive → Store → Emit → Fetch** pattern:

1. **Receive:** The WebSocket server receives messages from OWLCMS (`update`, `timer`, `decision`, `database`).
2. **Store:** The `CompetitionHub` updates its internal state stores (`databaseState` or `fopUpdates`) with the new data.
3. **Emit:** The Hub emits an event (e.g., `update`, `timer`) to notify subscribers that new data is available.
4. **Fetch:** Subscribers (like the SSE Broker in `owlcms-tracker`) receive the event and fetch the latest processed data from the Hub to broadcast to clients.

This decoupling ensures that:
- The Hub is the single source of truth.
- Subscribers don't need to manage raw WebSocket state.
- Data is processed once and cached, ready for high-frequency access.

## Competition Hub State Stores

The hub maintains several state stores to serve requests without re-reading raw WebSocket payloads:

### Primary Data Stores

- **`databaseState`** – Full competition database from OWLCMS (athletes, teams, categories, competition settings, records, etc.). Refreshed when `database` or `database_zip` messages arrive. **Critical:** The hub also merges `sessionAthletes` from update messages back into `databaseState` to keep the database synchronized with current session data (attempts, totals, rankings). This ensures long-running scoreboards always see fresh attempt data even between full database refreshes.

- **`fopUpdates`** – Per-FOP map keyed by `fopName` (e.g., `'Platform_A'`). Each entry merges the latest `update`, `timer`, and `decision` payloads for that platform, giving downstream helpers one-stop access to lifting order, timer state, and decision lights. The `sessionAthletes` field contains database athlete info enriched with precomputed display data (current athlete flag, etc.). The `startOrderAthletes` and `liftingOrderAthletes` arrays are lightweight ID lists (plus spacer rows) that reference session athlete objects without duplicating data.

### Translation and Asset Stores

- **`translations`** – Per-locale translation map (e.g., `{ 'en': { 'Start': 'Start', ... }, 'fr': { ... } }`). Populated by `translations_zip` binary messages. Supports regional variants with base-language fallback (e.g., `'fr-CA'` falls back to `'fr'`).

- **`translationsReady`** – Boolean flag indicating all translation locales have been loaded.

- **Asset Readiness Flags** – Boolean flags tracking extraction status for binary ZIP resources:
  - `flagsReady` – Country flags extracted to `<localFilesDir>/flags/`
  - `logosReady` – Federation logos extracted to `<localFilesDir>/logos/`
  - `picturesReady` – Athlete pictures extracted to `<localFilesDir>/pictures/`

### Derived Views (Computed on Request)

Commonly accessed via helper methods that process stored data on-demand:

- **`getSessionAthletes(fopName)`** – Flattened array of athletes in the current session (from `fopUpdates[fopName].sessionAthletes`).
- **`getStartOrderEntries(fopName, options)`** – Ordered list of athletes for display (filters by gender, team, etc.).
- **`getSessionStatus(fopName)`** – Session state (active, done, break, etc.).
- **`getAvailableFOPs()`** – Discovered FOP names from database or received updates.
- **`getTranslations(locale)`** – Translation map for a specific locale with fallback chain.
- **`getTeamRankings(...)`, `getTeamNameById(...)`, etc.** – Team-related computed views.

These derived views are **not stored** directly but computed from `databaseState` and `fopUpdates` when requested.


## OWLCMS WebSocket Integration

OWLCMS sends data to the tracker via **WebSocket connection** using both **text (JSON) and binary frames**.

**URL Format:** `ws://localhost:8096/ws` (or `wss://` for secure connections)

**Benefits:**
- ✅ Persistent connection - more efficient
- ✅ Lower latency - instant message delivery
- ✅ Single connection for all event types (text + binary)
- ✅ Automatic reconnection support

---

### Text Messages (JSON)

Text frames carry competition state updates in JSON format:

```json
{
  "type": "update|timer|decision|database",
  "payload": {
    // Nested JSON objects with competition data
  }
}
```

#### WebSocket Message: type="database"
Receives full competition database (athletes, categories, FOPs, etc.) as JSON text or as an empty placeholder indicating a `database_zip` binary frame will follow.

**Competition Hub Action:**
- Calls `handleFullCompetitionData(payload)` to replace `databaseState`.
- Re-indexes athletes for fast lookup via `_reindexDatabaseAthletes()`.
- Emits `competition_initialized` and `database:ready` events.
- If hub now has both database and translations, emits `hub:ready`.

**Database Sync:** When update messages arrive with `sessionAthletes`, the hub calls `_mergeSessionAthletesIntoDatabase(fopName)` to keep `databaseState` synchronized with session data. This ensures scoreboard plugins always see current attempts, totals, and rankings even if a full database refresh hasn't occurred recently.

#### WebSocket Message: type="update"
Receives UI event updates (lifting order changes, athlete switches, etc.) including enriched `sessionAthletes` data.

**Competition Hub Action:**
- Updates `fopUpdates[fopName]` with the new payload.
- Calls `_rebuildDerivedState(fopName)` to recompute session indexes.
- **Crucially:** Calls `_mergeSessionAthletesIntoDatabase(fopName)` to keep `databaseState` in sync with session athlete data (attempts, totals, ranks).
- Emits `update` event.

#### WebSocket Message: type="timer"
Receives timer start/stop/set events.

**Competition Hub Action:**
- Updates timer fields in `fopUpdates[fopName]` (e.g., `athleteTimerEventType`, `athleteMillisRemaining`, `timeAllowed`).
- Emits `timer` event.

#### WebSocket Message: type="decision"
Receives referee decisions.

**Competition Hub Action:**
- Updates decision fields in `fopUpdates[fopName]` (e.g., `decisionEventType`, `refereeDecisions`).
- Emits `decision` event.

For detailed message field definitions, see **[WEBSOCKET_MESSAGE_SPEC.md](./WEBSOCKET_MESSAGE_SPEC.md)**.

---

### Binary Messages (ZIP Resources)

Binary frames carry ZIP archives containing bulk resources. The hub extracts these to `<localFilesDir>/` and sets readiness flags.

**Binary Frame Format:**
- **Versioned (v2):** Starts with `TRACKv2\0` magic header (8 bytes), followed by type name, then ZIP payload.
- **Legacy:** Raw ZIP file (magic bytes `50 4B 03 04`).

**Supported Binary Message Types:**

#### Binary Message: database_zip
Full competition database as a ZIP archive containing `competition.json`.

**Competition Hub Action:**
- Extracts JSON from ZIP and calls `handleFullCompetitionData(database)`.
- Same effects as text `type="database"` message (replaces `databaseState`, re-indexes, emits events).

#### Binary Message: translations_zip
Translations for all locales as a ZIP archive containing `translations.json`.

**Competition Hub Action:**
- Extracts `translations.json` containing per-locale translation maps.
- Calls `hub.setTranslations(locale, translationMap)` for each locale.
- Sets `translationsReady = true` and calls `markTranslationsComplete()`.
- Emits `hub:ready` if database is also loaded.
- Supports checksum-based caching to skip redundant reprocessing.

#### Binary Message: flags_zip
Country flags as a ZIP archive.

**Competition Hub Action:**
- Extracts all files to `<localFilesDir>/flags/`.
- Sets `flagsReady = true`.
- Emits `flags_loaded` event with extraction count.

#### Binary Message: logos_zip
Federation logos as a ZIP archive.

**Competition Hub Action:**
- Extracts all files to `<localFilesDir>/logos/`.
- Sets `logosReady = true`.
- Emits `logos_loaded` event with extraction count.

#### Binary Message: pictures_zip
Athlete pictures as a ZIP archive.

**Competition Hub Action:**
- Extracts all files to `<localFilesDir>/pictures/`.
- Sets `picturesReady = true`.
- Emits `pictures_loaded` event with extraction count.

**Note:** Asset readiness flags allow consumers to conditionally serve resources based on extraction status.

## FOP Name Discovery

FOP names are **dynamically discovered** from:

1. **Database state** - `competition.fops` array
2. **Received updates** - Keys in `fopUpdates` map
3. **Fallback** - Default FOP 'A'

Example database structure:
```json
{
  "competition": {
    "name": "Provincial Championship",
    "fops": ["Platform_A", "Platform_B", "Platform_C"]
  },
  "athletes": [...]
}
```

## Development Mode - Data Persistence

The competition hub uses **globalThis persistence** to survive Vite HMR (Hot Module Reload):

```javascript
// Export singleton instance
// Use globalThis to persist across HMR (Vite hot reload)
if (!globalThis.__competitionHub) {
  globalThis.__competitionHub = new CompetitionHub();
  console.log('[Hub] Creating new CompetitionHub instance');
} else {
  console.log('[Hub] Reusing existing CompetitionHub instance (HMR)');
}

export const competitionHub = globalThis.__competitionHub;
```

**Benefits:**
- ✅ **Competition data persists** when editing code during development
- ✅ **No need to resend** database/update messages after code changes
- ✅ **Faster development** cycle - see changes immediately without losing state
- ✅ **Production-ready** - globalThis has no impact in production (no HMR)
