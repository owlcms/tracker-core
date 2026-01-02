/**
 * Binary WebSocket frame handler for OWLCMS flags and pictures
 *
 * Handles binary frames from OWLCMS containing ZIP archives with flags/pictures
 *
 * Frame format (Version 2.0.0+):
 *   [version_length:4 bytes BE] [version_string:UTF-8] [type_length:4 bytes BE] [type_string:UTF-8] [ZIP payload]
 *
 * Example: 6-byte "2.0.0" + 5-byte "flags" frame:
 *   [0x00,0x00,0x00,0x05] [2,.,0,.,0] [0x00,0x00,0x00,0x05] [f,l,a,g,s] [ZIP...]
 *
 * Legacy format (before Version 2.0.0):
 *   [type_length:4 bytes BE] [type_string:UTF-8] [ZIP payload]
 */

import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { isVersionAcceptable, parseVersion } from '../protocol/protocol-config.js';
import { logger } from '../utils/logger.js';
import { captureBinaryMessage, LEARNING_MODE } from '../utils/learning-mode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveLocalDir(subdir, hub) {
	const base = typeof hub?.getLocalFilesDir === 'function' && hub.getLocalFilesDir() ? hub.getLocalFilesDir() : path.join(process.cwd(), 'local');
	return path.join(base, subdir);
}

/**
 * Sanity check after flags extraction
 * Verifies flags directory and file count
 * NOTE: Flags directory is cleared on server startup, count is since server startup
 */
function verifySanityAfterFlags(hub) {
	try {
		const flagsDir = resolveLocalDir('flags', hub);
		if (!fs.existsSync(flagsDir)) {
			logger.warn(`[Sanity] ⚠️  Flags directory does not exist (${flagsDir})`);
			return 0;
		}

		const files = fs.readdirSync(flagsDir);
		const flagCount = files.length;
		if (flagCount === 0) {
			logger.warn('[Sanity] ⚠️  Flags directory is empty');
			return 0;
		}

		if (process.env.SANITY_DEBUG === 'true') {
			logger.debug(`[Sanity] ✅ Flags: ${flagCount} total files in ${flagsDir} (since server startup)`);
		}
		return flagCount;
	} catch (error) {
		logger.error(`[Sanity] ❌ Flags verification failed:`, error.message);
		return 0;
	}
}

/**
 * Sanity check after translations load
 * Verifies locale count and key coverage
 */
async function verifySanityAfterTranslations(hub) {
	try {
		// Get all available locales (not just one)
		const availableLocales = hub.getAvailableLocales();
		const localeCount = availableLocales.length;

		if (localeCount === 0) {
			logger.warn('[Sanity] ⚠️  No translations cached');
			return 0;
		}

		// Count total keys across all locales
		let totalKeys = 0;
		for (const locale of availableLocales) {
			const translationMap = hub.getTranslations(locale);
			if (translationMap && typeof translationMap === 'object') {
				totalKeys += Object.keys(translationMap).length;
			}
		}

		logger.info(`[Sanity] ✅ Translations: ${localeCount} locales, ${totalKeys} total translation keys cached in single hub instance`);
		return localeCount;
	} catch (error) {
		logger.error(`[Sanity] ❌ Translations verification failed:`, error.message);
		return 0;
	}
}

/**
 * Parse and route binary message from OWLCMS
 * @param {Buffer} buffer - Binary frame data
 * @param {object} hub - CompetitionHub instance (injected)
 */
export async function handleBinaryMessage(buffer, hub) {
	const startTime = Date.now();
	const operationId = Math.random().toString(36).substr(2, 9);

	if (!hub) {
		throw new Error('handleBinaryMessage requires injected hub instance');
	}

	if (process.env.BINARY_DEBUG === 'true') {
		logger.debug(`[BINARY] Starting operation ${operationId}`);
	}

	try {
		// Validate minimum frame size
		if (buffer.length < 4) {
			logger.error('[BINARY] ERROR: Frame too short (< 4 bytes)');
			return;
		}

		// Read first 4-byte integer
		const firstLength = buffer.readUInt32BE(0);

		if (process.env.BINARY_DEBUG === 'true') {
			const preview = buffer.slice(0, Math.min(20, buffer.length)).toString('hex');
			logger.debug(`[BINARY] Frame start (hex): ${preview}`);
			logger.debug(`[BINARY] First 4-byte value: ${firstLength} (0x${firstLength.toString(16)}), total frame: ${buffer.length} bytes`);
		}

		let offset = 0;
		let protocolVersion = null;
		let messageType = null;
		let payload = null;

		// Detect frame format by checking if first value looks like a version length (typically 5-7)
		// vs a type length (typically 5-17 for "translations_zip", "flags", etc)
		//
		// If firstLength is 5-7 and buffer contains valid UTF-8 that looks like a version (e.g., "2.0.0"),
		// treat it as version 2.0.0+ format. Otherwise, treat as legacy format.

		if (firstLength <= 20 && firstLength > 0 && buffer.length >= 4 + firstLength + 4) {
			// Try to parse as version string
			try {
				const potentialVersion = buffer.slice(4, 4 + firstLength).toString('utf8');
				const parsedVer = parseVersion(potentialVersion);

				if (parsedVer) {
					// Looks like a valid version string (e.g., "2.0.0")
					if (process.env.BINARY_DEBUG === 'true') {
						logger.debug(`[BINARY] ✅ Detected version 2.0.0+ format with protocol version: ${potentialVersion}`);
					}
					const versionCheck = isVersionAcceptable(potentialVersion);
					if (!versionCheck.valid) {
						logger.error(`[BINARY] ❌ Protocol version validation failed: ${versionCheck.error}`);
						return;
					}

					protocolVersion = potentialVersion;
					offset = 4 + firstLength;

					// Now read the message type
					if (buffer.length < offset + 4) {
						logger.error(`[BINARY] ERROR: Frame too short for type length at offset ${offset}`);
						return;
					}

					const typeLength = buffer.readUInt32BE(offset);
					offset += 4;

					if (buffer.length < offset + typeLength) {
						logger.error(
							`[BINARY] ERROR: Frame too short for type (need ${offset + typeLength}, got ${buffer.length})`
						);
						return;
					}

					messageType = buffer.slice(offset, offset + typeLength).toString('utf8');
					offset += typeLength;
					payload = buffer.slice(offset);

				} else {
					// Not a version string, treat as legacy format
					if (process.env.BINARY_DEBUG === 'true') {
						logger.debug(`[BINARY] Detected legacy format (no version header)`);
					}
					messageType = buffer.slice(4, 4 + firstLength).toString('utf8');
					payload = buffer.slice(4 + firstLength);
				}
			} catch (e) {
				// Failed to parse as version, treat as legacy format
				logger.info(`[BINARY] Treating as legacy format: ${e.message}`);
				messageType = buffer.slice(4, 4 + firstLength).toString('utf8');
				payload = buffer.slice(4 + firstLength);
			}
		} else {
			// Sanity check: if firstLength is unreasonably large (> 10MB), it's probably malformed
			if (firstLength > 10 * 1024 * 1024) {
				// Try to detect if this is a ZIP file (starts with 504B0304)
				if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
					logger.info('[BINARY] ℹ️  Detected ZIP file without type prefix - treating as flags_zip');
					handleFlagsMessage(buffer, hub);
					return;
				}
				logger.error(
					`[BINARY] ERROR: firstLength appears malformed (${firstLength} bytes, 0x${firstLength.toString(16)}), but buffer is only ${buffer.length} bytes total`
				);
				return;
			}

			// Legacy format: firstLength is the type length
			logger.info(`[BINARY] Treating as legacy format: firstLength=${firstLength} appears to be type length`);

			if (buffer.length < 4 + firstLength) {
				logger.error(
					`[BINARY] ERROR: Frame too short for type (need ${4 + firstLength}, got ${buffer.length})`
				);
				return;
			}

			messageType = buffer.slice(4, 4 + firstLength).toString('utf8');
			payload = buffer.slice(4 + firstLength);
		}

		// Route to handler based on message type
		logger.info(`[BINARY] Processing message type: ${messageType} (payload: ${payload.length} bytes)`);
		
		// Capture binary message in learning mode
		if (LEARNING_MODE) {
			captureBinaryMessage(messageType, payload, { payloadSize: payload.length });
		}
		
		if (messageType === 'database_zip' || messageType === 'database') {
			await handleDatabaseZipMessage(payload, hub);
		} else if (messageType === 'flags_zip') {
			await handleFlagsMessage(payload, hub);
		} else if (messageType === 'flags') {
			// Legacy support for old 'flags' message type
			await handleFlagsMessage(payload, hub);
		} else if (messageType === 'pictures_zip') {
			await handlePicturesMessage(payload, hub);
		} else if (messageType === 'pictures') {
			// Legacy support for old 'pictures' message type
			await handlePicturesMessage(payload, hub);
		} else if (messageType === 'translations_zip') {
			await handleTranslationsZipMessage(payload, hub);
		} else if (messageType === 'logos_zip') {
			await handleLogosMessage(payload, hub);
		}

		const elapsed = Date.now() - startTime;
		if (process.env.BINARY_DEBUG === 'true') {
			logger.log(`[BINARY] ✅ Operation ${operationId} completed in ${elapsed}ms (type: ${messageType})`);
		}
	} catch (error) {
		const elapsed = Date.now() - startTime;
		logger.error(`[BINARY] ❌ Operation ${operationId} FAILED after ${elapsed}ms:`, error.message);
		logger.error('[BINARY] Stack trace:', error.stack);
	}
}

/**
 * Extract flags ZIP archive to <localFilesDir>/flags
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
async function handleFlagsMessage(zipBuffer, hub) {
	const startTime = Date.now();
	let extractedCount = 0;

	try {
		// Parse ZIP from buffer
		const zip = new AdmZip(zipBuffer);
		const flagsDir = resolveLocalDir('flags', hub);

		// Ensure target directory exists
		if (!fs.existsSync(flagsDir)) {
			fs.mkdirSync(flagsDir, { recursive: true });
		}

		// Extract all files from ZIP
		const flagFileNames = [];
		zip.getEntries().forEach((entry) => {
			if (!entry.isDirectory) {
				const targetPath = path.join(flagsDir, entry.entryName);
				const parentDir = path.dirname(targetPath);

				// Create parent directory if needed
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				// Write file
				fs.writeFileSync(targetPath, entry.getData());
				extractedCount++;

				// Track first 10 flag file names
				if (flagFileNames.length < 10) {
					flagFileNames.push(entry.entryName);
				}
			}
		});

		const elapsed = Date.now() - startTime;
		logger.log(`[FLAGS] ✅ Extracted ${extractedCount} flag files in ${elapsed}ms`);
		if (process.env.SANITY_DEBUG === 'true') {
			// Log first 10 flags from this extraction
			if (flagFileNames.length > 0) {
				logger.log('[Sanity] First 10 flags from this extraction:');
				flagFileNames.forEach((name, index) => {
					logger.log(`  ${index + 1}. ${name}`);
				});
			}
		}

		// Run sanity check after successful extraction (shows cumulative count)
		verifySanityAfterFlags(hub);

		// Update hub state
		hub.setFlagsReady(true);

		// Emit event for interested listeners
		hub.emit('flags_loaded', {
			count: extractedCount,
			timestamp: Date.now()
		});
	} catch (error) {
		const elapsed = Date.now() - startTime;
		logger.error(`[FLAGS] ❌ ERROR after ${elapsed}ms:`, error.message);
		hub.setFlagsReady(false);
	}
}

/**
 * Extract pictures ZIP archive to <localFilesDir>/pictures
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
async function handlePicturesMessage(zipBuffer, hub) {
	const startTime = Date.now();
	let extractedCount = 0;

	try {
		const zip = new AdmZip(zipBuffer);
		const picturesDir = resolveLocalDir('pictures', hub);

		// Ensure target directory exists
		if (!fs.existsSync(picturesDir)) {
			fs.mkdirSync(picturesDir, { recursive: true });
		}

		// Extract all files from ZIP
		zip.getEntries().forEach((entry) => {
			if (!entry.isDirectory) {
				const targetPath = path.join(picturesDir, entry.entryName);
				const parentDir = path.dirname(targetPath);

				// Create parent directory if needed
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				fs.writeFileSync(targetPath, entry.getData());
				extractedCount++;
			}
		});

		const elapsed = Date.now() - startTime;
		logger.log(`[PICTURES] ✅ Extracted ${extractedCount} picture files in ${elapsed}ms`);

		// Update hub state
		hub.setPicturesReady(true);

		// Emit event for interested listeners
		hub.emit('pictures_loaded', {
			count: extractedCount,
			timestamp: Date.now()
		});
	} catch (error) {
		const elapsed = Date.now() - startTime;
		logger.error(`[PICTURES] ❌ ERROR after ${elapsed}ms:`, error.message);
		hub.setPicturesReady(false);
	}
}

/**
 * Extract logos ZIP archive to <localFilesDir>/logos
 * @param {Buffer} zipBuffer - ZIP file buffer
 */
async function handleLogosMessage(zipBuffer, hub) {
	const startTime = Date.now();
	let extractedCount = 0;

	try {
		const zip = new AdmZip(zipBuffer);
		const logosDir = resolveLocalDir('logos', hub);

		// Ensure target directory exists
		if (!fs.existsSync(logosDir)) {
			fs.mkdirSync(logosDir, { recursive: true });
		}

		// Extract all files from ZIP
		const logoFileNames = [];
		zip.getEntries().forEach((entry) => {
			if (!entry.isDirectory) {
				const targetPath = path.join(logosDir, entry.entryName);
				const parentDir = path.dirname(targetPath);

				// Create parent directory if needed
				if (!fs.existsSync(parentDir)) {
					fs.mkdirSync(parentDir, { recursive: true });
				}

				fs.writeFileSync(targetPath, entry.getData());
				extractedCount++;

				// Track first 10 logo file names
				if (logoFileNames.length < 10) {
					logoFileNames.push(entry.entryName);
				}
			}
		});

		const elapsed = Date.now() - startTime;
		logger.log(`[LOGOS] ✅ Extracted ${extractedCount} logo files in ${elapsed}ms`);
		if (process.env.SANITY_DEBUG === 'true') {
			if (logoFileNames.length > 0) {
				logger.log('[Sanity] First 10 logos from this extraction:');
				logoFileNames.forEach((name, index) => {
					logger.log(`  ${index + 1}. ${name}`);
				});
			}
		}

		// Update hub state
		hub.setLogosReady(true);

		// Emit event for interested listeners
		hub.emit('logos_loaded', {
			count: extractedCount,
			timestamp: Date.now()
		});
	} catch (error) {
		const elapsed = Date.now() - startTime;
		logger.error(`[LOGOS] ❌ ERROR after ${elapsed}ms:`, error.message);
		hub.setLogosReady(false);
	}
}
/**
 * Handle database ZIP message
 * @param {Buffer} zipBuffer - ZIP file buffer containing database JSON
 */
async function handleDatabaseZipMessage(zipBuffer, hub) {
	const startTime = Date.now();
	
	logger.info(`[DATABASE_ZIP] Processing buffer: ${zipBuffer.length} bytes, first 4 bytes: ${zipBuffer.slice(0, 4).toString('hex')}`);

	try {
		// Check if this is actually a ZIP file (magic bytes: 50 4B 03 04)
		const isZip = zipBuffer.length >= 4 && 
			zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4B && 
			zipBuffer[2] === 0x03 && zipBuffer[3] === 0x04;
		
		let jsonText;
		let database;
		
		if (!isZip) {
			// Maybe it's raw JSON, not a ZIP?
			logger.info('[DATABASE_ZIP] Not a ZIP file - checking if raw JSON...');
			const firstChar = String.fromCharCode(zipBuffer[0]);
			if (firstChar === '{') {
				logger.info('[DATABASE_ZIP] Detected raw JSON (not zipped)');
				jsonText = zipBuffer.toString('utf8');
				database = JSON.parse(jsonText);
			} else {
				logger.error(`[DATABASE_ZIP] ❌ Not a ZIP and not JSON. First byte: 0x${zipBuffer[0].toString(16)}`);
				return;
			}
		} else {
			const zip = new AdmZip(zipBuffer);
			const entries = zip.getEntries();
			
			logger.info(`[DATABASE_ZIP] ZIP contains ${entries.length} entries: ${entries.map(e => e.entryName).join(', ')}`);

			if (entries.length === 0) {
				logger.error('[DATABASE_ZIP] ❌ No entries found in ZIP');
				return;
			}

			// Find competition.json entry (OWLCMS sends competition.json, not database.json)
			const dbEntry = entries.find((e) => 
				e.entryName === 'competition.json' || e.entryName === 'database.json' || e.entryName.endsWith('.json')
			);
			if (!dbEntry) {
				logger.error(`[DATABASE_ZIP] ❌ No JSON file found in ZIP. Entries: ${entries.map(e => e.entryName).join(', ')}`);
				return;
			}
			
			logger.info(`[DATABASE_ZIP] Found: ${dbEntry.entryName}`);

			// Extract and parse JSON
			jsonText = dbEntry.getData().toString('utf8');
			database = JSON.parse(jsonText);
		}
		
		// Capture in learning mode (full database content, like main branch does)
		if (LEARNING_MODE) {
			const { captureMessage } = await import('../utils/learning-mode.js');
			captureMessage(database, jsonText, '', 'DATABASE_ZIP');
		}

		logger.info(`[DATABASE_ZIP] ✅ Extracted database (${jsonText.length} bytes uncompressed)`);
		logger.info(`[DATABASE_ZIP] Processing database with ${database.athletes?.length || 0} athletes`);

		// Process through hub's handleFullCompetitionData (same as main branch)
		// This emits database:ready and hub:ready events properly
		const result = hub.handleFullCompetitionData(database);

		const elapsed = Date.now() - startTime;
		const ratio = isZip ? ((1 - zipBuffer.length / jsonText.length) * 100).toFixed(1) : 0;
		logger.info(`[DATABASE_ZIP] ✅ Complete (${zipBuffer.length} → ${jsonText.length} bytes, ${ratio}% compression, ${elapsed}ms)`);
		
		if (!result.accepted) {
			logger.warn(`[DATABASE_ZIP] ⚠️  Database processing result: ${result.reason}`);
		}

		return result;
	} catch (error) {
		const elapsed = Date.now() - startTime;
		logger.error(`[DATABASE_ZIP] ❌ ERROR after ${elapsed}ms:`, error.message);
		logger.error('[DATABASE_ZIP] Stack trace:', error.stack);
	}
}

/**
 * Handle translations ZIP message
 * @param {Buffer} zipBuffer - ZIP file buffer containing translations.json
 */
async function handleTranslationsZipMessage(zipBuffer, hub) {
	const startTime = Date.now();

	try {
		const zip = new AdmZip(zipBuffer);
		const entries = zip.getEntries();

		if (entries.length === 0) {
			logger.error('[TRANSLATIONS_ZIP] ❌ No entries found in ZIP');
			return;
		}

		// Find translations.json entry
		const translationsEntry = entries.find((e) => e.entryName === 'translations.json');
		if (!translationsEntry) {
			logger.error('[TRANSLATIONS_ZIP] ❌ No translations.json found in ZIP');
			return;
		}

		// Extract and parse JSON
		const jsonText = translationsEntry.getData().toString('utf8');
		const translationsData = JSON.parse(jsonText);

		// Check for checksum optimization
		const checksum = translationsData.translationsChecksum;
		if (checksum && hub.getLastTranslationsChecksum() === checksum) {
			logger.log('[TRANSLATIONS_ZIP] ✅ Checksum match - skipping reprocessing');
			return;
		}

		// Determine structure: wrapper form or direct form
		const localesMap = translationsData.locales || translationsData;

		// Process each locale
		let localeCount = 0;
		let totalKeys = 0;
		for (const [locale, translationMap] of Object.entries(localesMap)) {
			if (typeof translationMap === 'object' && translationMap !== null) {
				hub.setTranslations(locale, translationMap);
				localeCount++;
				totalKeys += Object.keys(translationMap).length;
			}
		}

		// Cache checksum if provided
		if (checksum) {
			hub.setLastTranslationsChecksum(checksum);
		}

		const elapsed = Date.now() - startTime;
		logger.log(`[TRANSLATIONS_ZIP] ✅ Loaded ${localeCount} locales (${totalKeys} keys) in ${elapsed}ms`);

		// Run sanity check
		await verifySanityAfterTranslations(hub);

		// Update hub state
		hub.setTranslationsReady(true);
	} catch (error) {
		const elapsed = Date.now() - startTime;
		logger.error(`[TRANSLATIONS_ZIP] ❌ ERROR after ${elapsed}ms:`, error.message);
		hub.setTranslationsReady(false);
	}
}
