import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';

import { handleBinaryMessage } from '../src/websocket/binary-handler.js';

const checksum = 'a'.repeat(64);
const database = {
	formatVersion: '2.0',
	exportDate: '2026-10-07T21:00:00Z',
	competition: { competitionName: 'Checksum metadata test' },
	athletes: [{ id: 1, fullName: 'Test Athlete' }]
};

const zip = new AdmZip();
zip.addFile('competition.json', Buffer.from(JSON.stringify(database), 'utf8'));
const zipBytes = zip.toBuffer();
const version = Buffer.from('69.0.0', 'utf8');
const type = Buffer.from('database_zip', 'utf8');
const frame = Buffer.alloc(4 + version.length + 4 + type.length + zipBytes.length);
frame.writeUInt32BE(version.length, 0);
version.copy(frame, 4);
frame.writeUInt32BE(type.length, 4 + version.length);
type.copy(frame, 8 + version.length);
zipBytes.copy(frame, 8 + version.length + type.length);

let received;
const hub = {
	handleFullCompetitionData(payload) {
		received = payload;
		return { accepted: true };
	}
};

await handleBinaryMessage(frame, hub, { databaseChecksum: checksum });

assert.equal(received.databaseChecksum, checksum);
assert.equal(received.exportDate, database.exportDate);
assert.deepEqual(received.athletes, database.athletes);
console.log('database checksum metadata test passed');
