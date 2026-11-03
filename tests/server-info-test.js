#!/usr/bin/env node

import assert from 'node:assert/strict';

delete process.env.OWLCMS_UPDATEKEY;

const { CompetitionHub } = await import('../src/competition-hub.js');
const { createWebSocketServer } = await import('../src/websocket/index.js');
const { WebSocket } = await import('ws');

const VERSION = '69.0.0';
const serverInfoEvents = [];
const authenticatedConnectionEvents = [];
const hub = new CompetitionHub();
const server = await createWebSocketServer({
	port: 18203,
	path: '/ws',
	hub,
	onServerInfo: (info) => serverInfoEvents.push(info),
	onAuthenticatedConnection: (info) => authenticatedConnectionEvents.push(info)
});
await new Promise((resolve) => setTimeout(resolve, 100));

async function connect() {
	const ws = new WebSocket('ws://127.0.0.1:18203/ws');
	await new Promise((resolve, reject) => {
		ws.once('open', resolve);
		ws.once('error', reject);
	});
	return ws;
}

async function send(ws, type, payload) {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(`No reply to ${type}`)), 2000);
		ws.once('message', (data) => {
			clearTimeout(timeout);
			resolve(JSON.parse(data.toString()));
		});
		ws.send(JSON.stringify({ version: VERSION, type, payload }));
	});
}

async function close(ws) {
	await new Promise((resolve) => {
		ws.once('close', resolve);
		ws.close();
	});
}

const current = await connect();
let reply = await send(current, 'server_info', { scheme: 'http', port: 8081 });
assert.equal(reply.status, 200);
assert.equal(reply.message, 'Server info accepted');
assert.equal(serverInfoEvents.length, 1);
assert.equal(serverInfoEvents[0].scheme, 'http');
assert.equal(serverInfoEvents[0].port, 8081);
assert.match(serverInfoEvents[0].remoteAddress, /127\.0\.0\.1$/);
assert.equal(authenticatedConnectionEvents.length, 0,
	'server_info prevents the legacy port-8080 fallback callback');
await close(current);

const legacy = await connect();
reply = await send(legacy, 'database_metadata', { databaseChecksum: 'a'.repeat(64) });
assert.equal(reply.status, 200);
assert.equal(authenticatedConnectionEvents.length, 1);
assert.match(authenticatedConnectionEvents[0].remoteAddress, /127\.0\.0\.1$/);
await close(legacy);

server.close();
console.log('server info test passed');
process.exit(0);
