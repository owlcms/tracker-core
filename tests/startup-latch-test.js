#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import AdmZip from 'adm-zip';

console.log('✓ Testing start latch...\n');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-latch-'));
process.env.OWLCMS_UPDATEKEY = 'secret-key';

const { CompetitionHub } = await import('../src/competition-hub.js');
const { createWebSocketServer } = await import('../src/websocket/index.js');
const { WebSocket } = await import('ws');

const VERSION = '69.0.0';
const KEY = 'secret-key';

function int(value) {
	const b = Buffer.alloc(4);
	b.writeUInt32BE(value, 0);
	return b;
}

function binaryFrame(type, payload) {
	const version = Buffer.from(VERSION);
	const typeBytes = Buffer.from(type);
	const keyBytes = Buffer.from(KEY);
	return Buffer.concat([int(version.length), version, int(typeBytes.length), typeBytes, payload,
		keyBytes, int(keyBytes.length), Buffer.from([0xA5, 0x4B, 0x45, 0x59])]);
}

function zipOf(name, content) {
	const zip = new AdmZip();
	zip.addFile(name, Buffer.from(JSON.stringify(content)));
	return zip.toBuffer();
}

const database = zipOf('competition.json', {
	formatVersion: '2.0',
	competition: { competitionName: 'Latch Test', competitionDate: '2026-10-26' },
	sessions: [{ name: 'M1' }],
	teams: [],
	athletes: [{ key: 7, firstName: 'John', lastName: 'Doe', sessionName: 'M1', fullBirthDate: '1990-01-01', team: null }]
});
const translations = zipOf('translations.json', { locales: { en: { Snatch: 'Snatch' } } });

const hub = new CompetitionHub();
const server = await createWebSocketServer({ port: 18199, path: '/ws', hub, localFilesDir: path.join(dir, 'local') });
await new Promise((r) => setTimeout(r, 200));

const ws = new WebSocket('ws://127.0.0.1:18199/ws');
await new Promise((resolve, reject) => {
	ws.once('open', resolve);
	ws.once('error', reject);
});
const received = [];
ws.on('message', (data) => received.push(JSON.parse(data.toString())));

// requests that leave on their own (not as a reply), e.g. the document logos after the database
let unsolicited = 0;
const transport = hub._requestResourcesCallback;
hub._requestResourcesCallback = (resources, options) => {
	unsolicited++;
	return transport(resources, options);
};

/** send a text message and return the reply to it (skipping unsolicited resource requests) */
async function send(type, payload) {
	const before = received.length;
	ws.send(JSON.stringify({ version: VERSION, type, payload: { updateKey: KEY, fop: 'A', ...payload } }));
	const deadline = Date.now() + 2000;
	while (Date.now() < deadline) {
		const reply = received.slice(before).find((m) => m.reason !== 'startup_document_resources');
		if (reply) return reply;
		await new Promise((r) => setTimeout(r, 20));
	}
	throw new Error(`no reply to ${type}`);
}

async function sendBinary(type, payload) {
	ws.send(binaryFrame(type, payload), { binary: true });
	await new Promise((r) => setTimeout(r, 300));
}

const update = { uiEvent: 'LiftingOrderUpdated', fopState: 'CURRENT_ATHLETE_DISPLAYED', mode: 'CURRENT_ATHLETE', break: 'false' };

// 1. OWLCMS sends the database and translations when the connection opens: that counts as the request, messages
//    received before they arrive are applied and answered 202
let reply = await send('update', { ...update, sessionName: 'M1' });
assert.equal(reply.status, 202, 'startup data expected from OWLCMS, not requested');
assert.equal(reply.reason, 'waiting_for_startup_data');
assert.deepEqual([...reply.waitingFor].sort(), ['database', 'translations']);

// 2. if they do not come, the retry loop asks for them (once per retry delay; forced here)
for (const resource of ['database', 'translations_zip']) {
	hub._pendingResources.get(resource).nextRetryAt = 0;
}
const retryDeadline = Date.now() + 3000;
let retry;
while (!retry && Date.now() < retryDeadline) {
	retry = received.find((m) => m.status === 428 && m.reason === 'startup_preconditions');
	await new Promise((r) => setTimeout(r, 50));
}
assert.ok(retry, 'missing startup data requested by the retry loop');
assert.deepEqual([...retry.missing].sort(), ['database', 'translations']);
assert.equal(retry.refresh, false);

// 3. after that request, messages still do not ask again
reply = await send('timer', { athleteTimerEventType: 'StartTime', athleteMillisRemaining: 60000 });
assert.equal(reply.status, 202, 'no second request while waiting');
assert.equal(reply.reason, 'waiting_for_startup_data');
reply = await send('decision', { decisionEventType: 'DOWN_SIGNAL', down: 'true' });
assert.equal(reply.status, 202, 'decision applied without asking again');

// 4. the database arrives: still waiting for the translations, still not asked again
await sendBinary('database_zip', database);
reply = await send('update', { ...update, sessionName: 'M2' });
assert.equal(reply.status, 202, 'translations still awaited, not requested again');
assert.deepEqual(reply.waitingFor, ['translations']);
assert.equal(hub.fopUpdates.A?.sessionName, 'M2', 'messages are applied while the latch is closed');
// pages get no session data before the translations: they would draw untranslated keys
assert.equal(hub.isReady(), false);
assert.equal(hub.getFopUpdate({ fopName: 'A' }), null, 'no FOP state for pages until database and translations');

// 5. the translations arrive: the latch opens
const versionBefore = hub.getFopStateVersion({ fopName: 'A' });
const dataUpdateBefore = hub.fopUpdates.A.lastDataUpdate;
await sendBinary('translations_zip', translations);
// pages built before the translations show untranslated keys: their caches must not be reused
assert.ok(hub.getFopStateVersion({ fopName: 'A' }) > versionBefore, 'API response cache invalidated by translations');
assert.ok(hub.fopUpdates.A.lastDataUpdate > dataUpdateBefore, 'plugin caches invalidated by translations');
assert.equal(hub.getFopUpdate({ fopName: 'A' })?.sessionName, 'M2', 'FOP state available once ready');
reply = await send('update', { ...update, sessionName: 'M2' });
assert.equal(reply.status, 200, 'latch open once database and translations are in');
assert.equal(received.filter((m) => m.status === 428 && m.missing?.includes('translations')).length, 1,
	'translations requested once (by the retry)');

// 6. on-demand resources: a resource already requested is not asked for again
const sentBefore = unsolicited;
assert.equal(hub.requestResources(['flags_zip']), true);
assert.equal(hub.requestResources(['flags_zip']), true, 'second request answered from the outstanding one');
assert.equal(unsolicited - sentBefore, 1, 'flags requested once');

ws.close();
server.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log('✓ Start latch tests passed\n');
process.exit(0);
