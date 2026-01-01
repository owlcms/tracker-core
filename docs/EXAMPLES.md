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
