#!/usr/bin/env node

import assert from 'node:assert/strict';
import { WebSocket } from 'ws';

import { CompetitionHub } from '../src/competition-hub.js';
import { requestDatabaseRefresh } from '../src/index.js';
import { createWebSocketServer } from '../src/websocket/index.js';

console.log('✓ Testing database refresh request helper...\n');

const port = 18095;
const path = '/ws';
const hub = new CompetitionHub();

const server = await createWebSocketServer({
	port,
	path,
	hub
});

try {
	const client = new WebSocket(`ws://127.0.0.1:${port}${path}`);

	await new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('WebSocket client did not connect in time')), 5000);
		client.once('open', () => {
			clearTimeout(timeout);
			resolve();
		});
		client.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
	});

	const messagePromise = new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error('Did not receive refresh request in time')), 5000);
		client.once('message', (data) => {
			clearTimeout(timeout);
			resolve(data.toString());
		});
	});

	const requested = requestDatabaseRefresh();
	assert.equal(requested, true, 'requestDatabaseRefresh should return true when connected');

	const rawMessage = await messagePromise;
	const message = JSON.parse(rawMessage);

	assert.equal(message.status, 428, 'refresh request should use 428 precondition response');
	assert.equal(message.reason, 'database_refresh', 'refresh request should identify database_refresh reason');
	assert.equal(message.refresh, true, 'refresh request should ask OWLCMS to refresh its cached resources');
	assert.deepEqual(message.missing, ['database'], 'refresh request should ask for database only');

	// Routine requests (not a refresh) must not ask OWLCMS to rebuild its cached archives. While the database
	// sent at connection is awaited, a message is answered 202; the retry loop then asks with refresh:false.
	const received = [];
	client.on('message', (data) => received.push(JSON.parse(data.toString())));
	client.send(JSON.stringify({
		version: '69.0.0',
		type: 'timer',
		payload: { fopName: 'A', athleteTimerEventType: 'SetTime', athleteMillisRemaining: '60000' }
	}));
	hub._pendingResources.get('database').nextRetryAt = 0;
	const deadline = Date.now() + 5000;
	let retry;
	while (!retry && Date.now() < deadline) {
		retry = received.find((m) => m.status === 428 && m.reason !== 'database_refresh');
		await new Promise((r) => setTimeout(r, 50));
	}
	assert.ok(received.some((m) => m.status === 202 && m.reason === 'waiting_for_startup_data'),
		'timer without database is applied and answered 202 while the startup data is awaited');
	assert.ok(retry, 'routine request for the missing database');
	assert.ok(retry.missing.includes('database'), 'routine request asks for the database');
	assert.equal(retry.refresh, false, 'routine request must carry an explicit refresh:false');

	await new Promise((resolve) => {
		client.once('close', resolve);
		client.close();
	});

	console.log('✓ Database refresh helper requested database successfully\n');
} finally {
	server.close();
}