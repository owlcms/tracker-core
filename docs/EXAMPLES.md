# Tracker Core Examples

This document provides examples of how to use the `@owlcms/tracker-core` package.

## Minimal Example

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
  // payload.athleteTimerEventType is 'StartTime', 'StopTime', or 'SetTime'
  if (payload.athleteTimerEventType === 'StartTime') {
    console.log(`Timer started on ${fopName}: ${payload.athleteMillisRemaining}ms remaining`);
  }
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

## vMix Integration Example

**Complete working example** - automatically switches vMix overlays based on competition events (good lift → show video, bad lift → show video, then back to scoreboard).

### 1. Install Dependencies

```bash
npm install @owlcms/tracker-core express axios
```

### 2. Create `vmix-controller.js`

```javascript
import { competitionHub, EVENT_TYPES, attachWebSocketToServer } from '@owlcms/tracker-core';
import express from 'express';
import axios from 'axios';

// vMix Configuration
const VMIX_HOST = 'http://localhost:8088'; // vMix HTTP API
const SCOREBOARD_INPUT = 1;  // Input number for scoreboard overlay
const GOOD_LIFT_INPUT = 2;   // Input number for "Good Lift" video
const BAD_LIFT_INPUT = 3;    // Input number for "Bad Lift" video

// Switch vMix input
async function switchVmixInput(inputNumber) {
  try {
    await axios.get(`${VMIX_HOST}/api/?Function=PreviewInput&Input=${inputNumber}`);
    await axios.get(`${VMIX_HOST}/api/?Function=Transition&Duration=500`);
    console.log(`[vMix] Switched to input ${inputNumber}`);
  } catch (error) {
    console.error('[vMix] Switch failed:', error.message);
  }
}

// Update scoreboard overlay with athlete data
async function updateVmixScoreboard(fopUpdate) {
  const currentAthlete = fopUpdate?.fullName || 'No athlete';
  const weight = fopUpdate?.weight || '--';
  const attempt = fopUpdate?.attemptNumber || '--';
  
  try {
    await axios.get(`${VMIX_HOST}/api/?Function=SetText&Input=${SCOREBOARD_INPUT}&Value=${currentAthlete}`);
    console.log(`[vMix] Updated scoreboard: ${currentAthlete} - ${weight}kg (Attempt ${attempt})`);
  } catch (error) {
    console.error('[vMix] Scoreboard update failed:', error.message);
  }
}

// Start Express server
const app = express();
const server = app.listen(8096, () => {
  console.log('[Server] Running on port 8096');
});

// Attach WebSocket handler to existing server (handles OWLCMS connection automatically)
attachWebSocketToServer({
  server,
  path: '/ws',
  hub: competitionHub,
  onConnect: () => console.log('[WebSocket] OWLCMS connected'),
  onDisconnect: () => console.log('[WebSocket] OWLCMS disconnected')
});

// Subscribe to competition events
competitionHub.on(EVENT_TYPES.DECISION, async ({ fopName, payload }) => {
  console.log(`[Decision] FOP ${fopName}: ${payload.decisionEventType}`);
  
  if (payload.decisionEventType === 'FULL_DECISION') {
    // Count good lifts (d1, d2, d3 are "true"/"false" strings)
    const goodCount = [payload.d1, payload.d2, payload.d3]
      .filter(d => d === 'true')
      .length;
    
    const isGoodLift = goodCount >= 2;
    
    // Switch to appropriate video
    await switchVmixInput(isGoodLift ? GOOD_LIFT_INPUT : BAD_LIFT_INPUT);
    
    // Return to scoreboard after 3 seconds
    setTimeout(async () => {
      await switchVmixInput(SCOREBOARD_INPUT);
    }, 3000);
  }
});

competitionHub.on(EVENT_TYPES.UPDATE, async ({ fopName, payload }) => {
  console.log(`[Update] FOP ${fopName}: ${payload.uiEvent}`);
  
  if (payload.uiEvent === 'LiftingOrderUpdated') {
    // Update scoreboard with new athlete info
    await updateVmixScoreboard(payload);
  }
});

competitionHub.on(EVENT_TYPES.TIMER, ({ fopName, payload }) => {
  if (payload.athleteTimerEventType === 'StartTime') {
    console.log(`[Timer] FOP ${fopName}: Timer started (${payload.athleteMillisRemaining}ms)`);
  }
});

console.log('[vMix Controller] Ready - waiting for OWLCMS connection');
console.log('[Setup] Configure OWLCMS: Prepare Competition → Language and System Settings → Connections');
console.log('[Setup] Set "URL for Video Data" to: ws://localhost:8096/ws');
```

### 3. Configure OWLCMS

In OWLCMS: **Prepare Competition → Language and System Settings → Connections → URL for Video Data**

Set to: `ws://localhost:8096/ws`

### 4. Configure vMix

1. Create inputs in vMix:
   - Input 1: Browser source pointing to scoreboard (e.g., `http://localhost:8096/lifting-order?fop=A`)
   - Input 2: Video file for "Good Lift" animation
   - Input 3: Video file for "Bad Lift" animation

2. Ensure vMix HTTP API is enabled (Settings → Web Controller → Enable)

### 5. Run

```bash
node vmix-controller.js
```

**What it does:**
- ✅ Receives all OWLCMS events (decisions, timer, updates)
- ✅ Automatically switches to good/bad lift video on referee decision
- ✅ Returns to scoreboard after 3 seconds
- ✅ Updates scoreboard overlay with current athlete info
