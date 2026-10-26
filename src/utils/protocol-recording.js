/**
 * Protocol recording (learning mode)
 *
 * Records every WebSocket frame of an OWLCMS connection, in both directions and in arrival order, to one JSON Lines
 * file: <LEARNING_MODE_DIR or ./samples>/recordings/recording-<start>.jsonl
 *
 * Line format:
 *   { "seq": 1, "at": "2026-10-26T17:00:00.000Z", "dir": "in"|"out", "frame": "text"|"binary",
 *     "type": "update", "text": "<raw JSON>" }                                  (text frames)
 *   { ..., "frame": "binary", "type": "database_zip", "bytes": 111690, "sha256": "<hex>" }   (binary frames)
 *
 * Binary frames (database, translations, flags, logos, pictures...) are summarized, not stored: the recording shows
 * what was sent and when, and stays small. Secrets are removed from text frames: updateKey, and in a database
 * bundled in a text frame the accounts and the configuration secrets (pins, MQTT password, keys).
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { LEARNING_MODE, SAMPLES_DIR } from './learning-mode.js';
import { logger } from './logger.js';

export const REDACTED = 'REDACTED';

const BINARY_KEY_TRAILER_MAGIC = Buffer.from([0xA5, 0x4B, 0x45, 0x59]);
const UPDATE_KEY_FIELDS = ['updateKey', 'update_key', 'updatekey'];
const SECRET_FIELD = /^(pin|displayPin|mqttPassword|updateKey|updatekey|update_key|videoDataKey|passwordHash|ipBackdoorList)$|password|secret|token|apiKey|privateKey/i;

/**
 * Start recording a connection.
 * @returns {{recordIn(data: Buffer|string, isBinary: boolean): void, recordOut(data: Buffer|string): void, close(): void, path: string}|null}
 *   null when learning mode is off or the file cannot be created
 */
export function startRecording() {
	if (!LEARNING_MODE) {
		return null;
	}
	try {
		const dir = path.join(SAMPLES_DIR, 'recordings');
		fs.mkdirSync(dir, { recursive: true });
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filePath = path.join(dir, `recording-${stamp}.jsonl`);
		fs.writeFileSync(filePath, '');
		logger.info(`[Learning Mode] Recording OWLCMS connection to ${filePath}`);
		let seq = 0;
		let open = true;

		const write = (entry) => {
			if (!open) return;
			try {
				fs.appendFileSync(filePath, JSON.stringify({ seq: ++seq, at: new Date().toISOString(), ...entry }) + '\n');
			} catch (err) {
				logger.error('[Learning Mode] Failed to write recording:', err.message);
			}
		};

		return {
			path: filePath,
			recordIn(data, isBinary) {
				if (isBinary) {
					const frame = stripKeyTrailer(Buffer.isBuffer(data) ? data : Buffer.from(data));
					write({
						dir: 'in',
						frame: 'binary',
						type: binaryFrameType(frame),
						bytes: frame.length,
						sha256: crypto.createHash('sha256').update(frame).digest('hex')
					});
				} else {
					const { text, type } = redactTextFrame(data.toString());
					write({ dir: 'in', frame: 'text', type, text });
				}
			},
			recordOut(data) {
				const text = Buffer.isBuffer(data) ? data.toString() : String(data);
				let type = null;
				try {
					const parsed = JSON.parse(text);
					type = parsed?.status != null ? String(parsed.status) : null;
				} catch {
					// not JSON
				}
				write({ dir: 'out', frame: 'text', type, text });
			},
			close() {
				open = false;
			}
		};
	} catch (err) {
		logger.error('[Learning Mode] Failed to start recording:', err.message);
		return null;
	}
}

/**
 * Read a recording file.
 * @param {string} filePath
 * @returns {Array<object>} frames, in order
 */
export function readRecording(filePath) {
	return fs.readFileSync(filePath, 'utf8')
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line));
}

/** Remove the update key from a text frame. */
export function redactTextFrame(text) {
	try {
		const message = JSON.parse(text);
		const payload = message?.payload;
		if (payload && typeof payload === 'object') {
			for (const field of UPDATE_KEY_FIELDS) {
				if (field in payload) {
					payload[field] = REDACTED;
				}
			}
			if (payload.database && typeof payload.database === 'object') {
				redactDatabase(payload.database);
			}
			if (message.type === 'database' && Array.isArray(payload.athletes)) {
				redactDatabase(payload);
			}
		}
		return { text: JSON.stringify(message), type: message?.type ?? null };
	} catch {
		return { text, type: null };
	}
}

/** Message type of a binary frame (versioned or legacy header), null if unknown. */
export function binaryFrameType(buffer) {
	return parseBinaryHeader(buffer)?.type ?? null;
}

/** Remove secrets from a competition database object (in place). */
export function redactDatabase(database) {
	if (Array.isArray(database.accounts)) {
		database.accounts = [];
	}
	redactSecrets(database);
	return database;
}

function redactSecrets(node) {
	if (Array.isArray(node)) {
		node.forEach(redactSecrets);
		return;
	}
	if (!node || typeof node !== 'object') {
		return;
	}
	for (const [key, value] of Object.entries(node)) {
		if (SECRET_FIELD.test(key) && value != null && typeof value !== 'object' && typeof value !== 'boolean') {
			node[key] = REDACTED;
		} else {
			redactSecrets(value);
		}
	}
}

function stripKeyTrailer(buffer) {
	if (buffer.length < BINARY_KEY_TRAILER_MAGIC.length + 4) {
		return buffer;
	}
	const magicStart = buffer.length - BINARY_KEY_TRAILER_MAGIC.length;
	if (!buffer.subarray(magicStart).equals(BINARY_KEY_TRAILER_MAGIC)) {
		return buffer;
	}
	const keyLength = buffer.readUInt32BE(magicStart - 4);
	const keyStart = magicStart - 4 - keyLength;
	return keyStart >= 0 ? buffer.subarray(0, keyStart) : buffer;
}

/**
 * Parse the binary frame header: [len][version][len][type] (OWLCMS 64+) or [len][type] (legacy).
 * @returns {{type: string, payloadOffset: number}|null}
 */
function parseBinaryHeader(buffer) {
	try {
		if (buffer.length < 8) {
			return null;
		}
		const firstLength = buffer.readUInt32BE(0);
		if (firstLength > 0 && firstLength <= 20 && buffer.length >= 8 + firstLength) {
			const version = buffer.subarray(4, 4 + firstLength).toString('utf8');
			if (/^\d+\.\d+\.\d+/.test(version)) {
				const typeLength = buffer.readUInt32BE(4 + firstLength);
				const typeStart = 8 + firstLength;
				if (buffer.length >= typeStart + typeLength) {
					return {
						type: buffer.subarray(typeStart, typeStart + typeLength).toString('utf8'),
						payloadOffset: typeStart + typeLength
					};
				}
			}
		}
		if (buffer.length >= 4 + firstLength && firstLength <= 64) {
			return { type: buffer.subarray(4, 4 + firstLength).toString('utf8'), payloadOffset: 4 + firstLength };
		}
	} catch {
		// malformed header
	}
	return null;
}
