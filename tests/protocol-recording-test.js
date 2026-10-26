#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import AdmZip from 'adm-zip';

console.log('✓ Testing protocol recording...\n');

// learning mode is read when the modules load: configure it first
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-recording-'));
process.env.LEARNING_MODE = 'true';
process.env.LEARNING_MODE_DIR = dir;
process.env.OWLCMS_UPDATEKEY = 'secret-key';

const { CompetitionHub } = await import('../src/competition-hub.js');
const { createWebSocketServer } = await import('../src/websocket/index.js');
const { readRecording, REDACTED } = await import('../src/utils/protocol-recording.js');
const { WebSocket } = await import('ws');

const VERSION = '69.0.0';

function binaryFrame(type, payload, key) {
	const version = Buffer.from(VERSION);
	const typeBytes = Buffer.from(type);
	const parts = [int(version.length), version, int(typeBytes.length), typeBytes, payload];
	if (key) {
		const keyBytes = Buffer.from(key);
		parts.push(keyBytes, int(keyBytes.length), Buffer.from([0xA5, 0x4B, 0x45, 0x59]));
	}
	return Buffer.concat(parts);
}

function int(value) {
	const b = Buffer.alloc(4);
	b.writeUInt32BE(value, 0);
	return b;
}

const database = {
	formatVersion: '2.0',
	competition: { competitionName: 'Recording Test', competitionDate: '2026-10-26' },
	config: { pin: '1234', displayPin: '5678', mqttPassword: 'mqtt-pass', updatekey: 'enc-key', videoDataKey: 'enc-video', mqttInternal: true },
	accounts: [{ username: 'admin', passwordHash: 'hash' }],
	sessions: [{ name: 'M1' }],
	teams: [],
	athletes: [{ key: 7, firstName: 'John', lastName: 'Doe', sessionName: 'M1', fullBirthDate: '1990-01-01', team: null }]
};
const zip = new AdmZip();
zip.addFile('competition.json', Buffer.from(JSON.stringify(database)));

async function connectedClient(port) {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
	await new Promise((resolve, reject) => {
		ws.once('open', resolve);
		ws.once('error', reject);
	});
	return ws;
}

async function closeClient(ws) {
	await new Promise((resolve) => {
		ws.once('close', resolve);
		ws.close();
	});
}

// 1. record a connection
let server = await createWebSocketServer({ port: 18197, path: '/ws', hub: new CompetitionHub(), localFilesDir: path.join(dir, 'local1') });
await new Promise((r) => setTimeout(r, 200));
let client = await connectedClient(18197);
client.send(binaryFrame('database_zip', zip.toBuffer(), 'secret-key'), { binary: true });
await new Promise((r) => setTimeout(r, 300));
const update = { version: VERSION, type: 'update', payload: { updateKey: 'secret-key', uiEvent: 'SwitchGroup', fop: 'A', fopState: 'CURRENT_ATHLETE_DISPLAYED', mode: 'CURRENT_ATHLETE', break: 'false', sessionName: 'M1' } };
const replied = new Promise((resolve) => client.once('message', resolve));
client.send(JSON.stringify(update));
await replied;
await closeClient(client);
await new Promise((r) => setTimeout(r, 100));
server.close();

const recordingsDir = path.join(dir, 'recordings');
const files = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.jsonl'));
assert.equal(files.length, 1, 'one recording per connection');
const frames = readRecording(path.join(recordingsDir, files[0]));

const incoming = frames.filter((f) => f.dir === 'in');
assert.deepEqual(incoming.map((f) => f.type), ['database_zip', 'update'], 'incoming frames in arrival order');
assert.ok(frames.some((f) => f.dir === 'out'), 'tracker replies recorded');
assert.deepEqual(frames.map((f) => f.seq), frames.map((_, i) => i + 1), 'sequence numbers');

const recordedUpdate = JSON.parse(incoming[1].text);
assert.equal(recordedUpdate.payload.updateKey, REDACTED, 'update key redacted in text frames');

const recordedBinary = incoming[0];
assert.equal(recordedBinary.base64, undefined, 'binary content not stored');
assert.ok(recordedBinary.bytes > zip.toBuffer().length, 'binary size recorded (header + ZIP, key trailer removed)');
assert.equal(recordedBinary.bytes, binaryFrame('database_zip', zip.toBuffer()).length, 'size without the key trailer');
assert.match(recordedBinary.sha256, /^[0-9a-f]{64}$/, 'binary checksum recorded');
assert.ok(!fs.readFileSync(path.join(recordingsDir, files[0]), 'utf8').includes('secret-key'), 'update key never recorded');

fs.rmSync(dir, { recursive: true, force: true });
console.log('✓ Protocol recording tests passed\n');
process.exit(0);
