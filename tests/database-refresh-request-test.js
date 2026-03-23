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
	assert.deepEqual(message.missing, ['database'], 'refresh request should ask for database only');

	await new Promise((resolve) => {
		client.once('close', resolve);
		client.close();
	});

	console.log('✓ Database refresh helper requested database successfully\n');
} finally {
	server.close();
}