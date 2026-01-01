/**
 * Flag Resolver - Team flag and logo URL utilities
 * Handles multiple flag formats and missing files gracefully
 */

import fs from 'fs';
import path from 'path';
import { competitionHub } from '../index.js';

const FLAG_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

// Resolve base directories and URL prefixes from hub configuration
function getAssetConfig() {
  const baseDir = competitionHub.getLocalFilesDir ? competitionHub.getLocalFilesDir() : path.join(process.cwd(), 'local');
  const urlPrefix = competitionHub.getLocalUrlPrefix ? competitionHub.getLocalUrlPrefix() : '/local';
  const normalizedPrefix = urlPrefix.endsWith('/') ? urlPrefix.slice(0, -1) : urlPrefix;
  return {
    flagsDir: path.join(baseDir, 'flags'),
    logosDir: path.join(baseDir, 'logos'),
    flagsPrefix: `${normalizedPrefix}/flags`,
    logosPrefix: `${normalizedPrefix}/logos`
  };
}

/**
 * Resolve flag path by team name
 * Tries exact match first, then uppercase, then each extension
 * @param {string} teamName - Team name or country code
 * @param {string} baseDir - Directory to search in (default: FLAGS_DIR)
 * @returns {string|null} Relative path to file (e.g., "local/flags/USA.svg") or null
 */
function resolveFilePath(name, baseDir, urlPrefix) {
  if (!name || typeof name !== 'string') return null;

  const trimmedName = name.trim();
  if (!trimmedName) return null;

  // Try exact case first
  for (const ext of FLAG_EXTENSIONS) {
    const fileName = `${trimmedName}${ext}`;
    const fullPath = path.join(baseDir, fileName);
    try {
      if (fs.existsSync(fullPath)) return `${urlPrefix}/${fileName}`;
    } catch (e) { continue; }
  }

  // Try uppercase
  const upperName = trimmedName.toUpperCase();
  for (const ext of FLAG_EXTENSIONS) {
    const fileName = `${upperName}${ext}`;
    const fullPath = path.join(baseDir, fileName);
    try {
      if (fs.existsSync(fullPath)) return `${urlPrefix}/${fileName}`;
    } catch (e) { continue; }
  }

  return null;
}

export function getFlagUrl({ teamName } = {}) {
  const { flagsDir, flagsPrefix } = getAssetConfig();
  const relativePath = resolveFilePath(teamName, flagsDir, flagsPrefix.replace(/^\//, ''));
  return relativePath ? (relativePath.startsWith('/') ? relativePath : `/${relativePath}`) : null;
}

export function getLogoUrl({ teamName } = {}) {
  const { logosDir, logosPrefix } = getAssetConfig();
  const relativePath = resolveFilePath(teamName, logosDir, logosPrefix.replace(/^\//, ''));
  return relativePath ? (relativePath.startsWith('/') ? relativePath : `/${relativePath}`) : null;
}

export function getFlagHtml({ teamName, width = 32, height = 24, className = 'flag' } = {}) {
  const url = getFlagUrl({ teamName });
  if (!url) return '';
  return `<img src="${url}" width="${width}" height="${height}" alt="${teamName}" class="${className}" />`;
}

export function getLogoHtml({ teamName, width = 64, height = 64, className = 'logo' } = {}) {
  const url = getLogoUrl({ teamName });
  if (!url) return '';
  return `<img src="${url}" width="${width}" height="${height}" alt="${teamName}" class="${className}" />`;
}

// Backward compatibility aliases (if needed by internal calls)
export function getFlagPath({ teamName } = {}) {
  const { flagsDir, flagsPrefix } = getAssetConfig();
  return resolveFilePath(teamName, flagsDir, flagsPrefix.replace(/^\//, ''));
}
