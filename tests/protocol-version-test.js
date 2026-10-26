#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import AdmZip from 'adm-zip';

console.log('✓ Testing required protocol version...\n');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-version-'));
delete process.env.OWLCMS_UPDATEKEY;

const { CompetitionHub } = await import('../src/competition-hub.js');
const { createWebSocketServer } = await import('../src/websocket/index.js');
const { MINIMUM_PROTOCOL_VERSION, isVersionAcceptable } = await import('../src/protocol/protocol-config.js');
const { WebSocket } = await import('ws');

assert.equal(MINIMUM_PROTOCOL_VERSION, '69.0.0', 'tracker-core requires OWLCMS 69');
// OWLCMS 66, 67 and 68 all send 64.0.0
assert.equal(isVersionAcceptable('64.0.0').valid, false);
assert.equal(isVersionAcceptable('68.9.9').valid, false);
assert.equal(isVersionAcceptable('69.0.0').valid, true);
assert.equal(isVersionAcceptable('69.0.0-rc08').valid, true);
assert.equal(isVersionAcceptable('70.1.0').valid, true);

function int(value) {
	const b = Buffer.alloc(4);
	b.writeUInt32BE(value, 0);
	return b;
}

function versionedFrame(version, type, payload) {
	const v = Buffer.from(version);
	const t = Buffer.from(type);
	return Buffer.concat([int(v.length), v, int(t.length), t, payload]);
}

function unversionedFrame(type, payload) {
	const t = Buffer.from(type);
	return Buffer.concat([int(t.length), t, payload]);
}

function zipOf(name, content) {
	const zip = new AdmZip();
	zip.addFile(name, Buffer.from(JSON.stringify(content)));
	return zip.toBuffer();
}

function databaseOf(competitionName) {
	return zipOf('competition.json', {
		formatVersion: '2.0',
		competition: { competitionName, competitionDate: '2026-10-26' },
		sessions: [{ name: 'M1' }],
		teams: [],
		athletes: [{ key: 7, firstName: 'John', lastName: 'Doe', sessionName: 'M1', fullBirthDate: '1990-01-01', team: null }]
	});
}

const hub = new CompetitionHub();
const server = await createWebSocketServer({ port: 18200, path: '/ws', hub, localFilesDir: path.join(dir, 'local') });
await new Promise((r) => setTimeout(r, 200));

const ws = new WebSocket('ws://127.0.0.1:18200/ws');
await new Promise((resolve, reject) => {
	ws.once('open', resolve);
	ws.once('error', reject);
});
let closed = false;
ws.on('close', () => { closed = true; });
const received = [];
ws.on('message', (data) => received.push(JSON.parse(data.toString())));

async function nextReply(action) {
	const before = received.length;
	action();
	const deadline = Date.now() + 2000;
	while (Date.now() < deadline) {
		if (received.length > before) return received[before];
		await new Promise((r) => setTimeout(r, 20));
	}
	return null;
}

const text = (version) => () => ws.send(JSON.stringify({
	version,
	type: 'update',
	payload: { fop: 'A', uiEvent: 'LiftingOrderUpdated', fopState: 'CURRENT_ATHLETE_DISPLAYED', sessionName: 'M1' }
}));
const binary = (frame) => () => ws.send(frame, { binary: true });

// 1. a text frame from OWLCMS 68 (protocol 64.0.0) is refused and reported to the tracker
let reply = await nextReply(text('64.0.0'));
assert.equal(reply?.status, 400);
assert.equal(reply.error, 'Protocol version check failed');
assert.equal(reply.details.received, '64.0.0');
assert.match(reply.reason, /69\.0\.0/);
assert.equal(hub.getProtocolError()?.received, '64.0.0');
assert.equal(hub.getProtocolError()?.minimum, '69.0.0');

// 2. so is a binary frame, and a binary frame without the version header
reply = await nextReply(binary(versionedFrame('64.0.0', 'database_zip', databaseOf('Old OWLCMS'))));
assert.equal(reply?.status, 400, 'versioned binary frame below the minimum is answered');
assert.equal(reply.details.received, '64.0.0');
assert.equal(hub.getDatabaseState(), null, 'refused database not applied');

reply = await nextReply(binary(unversionedFrame('database_zip', databaseOf('Unversioned'))));
assert.equal(reply?.status, 400, 'binary frame without version header is answered');
assert.equal(reply.details.received, null);
assert.equal(hub.getDatabaseState(), null, 'unversioned database not applied');

// 3. the connection stays open (OWLCMS would reconnect at once if it were closed)
assert.equal(closed, false);

// 4. a current sender is accepted and clears the error
reply = await nextReply(binary(versionedFrame('69.0.0-rc08', 'database_zip', databaseOf('Current OWLCMS'))));
await new Promise((r) => setTimeout(r, 300));
assert.equal(hub.getProtocolError(), null, 'protocol error cleared by an acceptable frame');
assert.equal(hub.getDatabaseState()?.competition?.competitionName, 'Current OWLCMS');

// 5. a refused frame cannot replace or reset data that is already loaded
reply = await nextReply(binary(versionedFrame('64.0.0', 'database_zip', databaseOf('Old OWLCMS again'))));
assert.equal(reply?.status, 400);
await new Promise((r) => setTimeout(r, 300));
assert.equal(hub.getDatabaseState()?.competition?.competitionName, 'Current OWLCMS', 'loaded database untouched');

ws.close();
server.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log('✓ Protocol version tests passed\n');
process.exit(0);
