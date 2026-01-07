/**
 * Asset Resolver - Team flags, logos, and athlete pictures URL utilities
 * Handles multiple asset formats and missing files gracefully
 * 
 * All functions use object parameter signatures for consistency
 */

import fs from 'fs';
import path from 'path';
import { competitionHub } from '../index.js';
import { logger } from './logger.js';

const FLAG_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

// Resolve base directories and URL prefixes from hub configuration
function getAssetConfig() {
  const baseDir = competitionHub.getLocalFilesDir ? competitionHub.getLocalFilesDir() : path.join(process.cwd(), 'local');
  const urlPrefix = competitionHub.getLocalUrlPrefix ? competitionHub.getLocalUrlPrefix() : '/local';
  const normalizedPrefix = urlPrefix.endsWith('/') ? urlPrefix.slice(0, -1) : urlPrefix;
  return {
    flagsDir: path.join(baseDir, 'flags'),
    logosDir: path.join(baseDir, 'logos'),
    picturesDir: path.join(baseDir, 'pictures'),
    flagsPrefix: `${normalizedPrefix}/flags`,
    logosPrefix: `${normalizedPrefix}/logos`,
    picturesPrefix: `${normalizedPrefix}/pictures`
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
  logger.trace('[asset-resolver] resolving logo url', { teamName, logosDir });
  const relativePath = resolveFilePath(teamName, logosDir, logosPrefix.replace(/^\//, ''));
  if (relativePath) {
    const url = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
    logger.trace('[asset-resolver] logo url resolved', { teamName, url });
    return url;
  }
  logger.trace('[asset-resolver] logo url not found', { teamName });
  return null;
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

export function getPictureUrl({ athleteId } = {}) {
  const { picturesDir, picturesPrefix } = getAssetConfig();
  const relativePath = resolveFilePath(athleteId, picturesDir, picturesPrefix.replace(/^\//, ''));
  return relativePath ? (relativePath.startsWith('/') ? relativePath : `/${relativePath}`) : null;
}

export function getPictureHtml({ athleteId, athleteName = '', width = 120, height = 150, className = 'picture' } = {}) {
  const url = getPictureUrl({ athleteId });
  if (!url) return '';
  return `<img src="${url}" width="${width}" height="${height}" alt="${athleteName}" class="${className}" />`;
}

/**
 * Get header logo URL by base name(s)
 * Tries each base name in order, scanning for available extensions: .svg, .png, .jpg, .jpeg, .webp
 * @param {string|string[]} baseNames - Single base name or array of names to try in order (e.g., ['header_left', 'left'])
 * @returns {string|null} URL path to first found logo or null if none found
 */
export function getHeaderLogoUrl({ baseNames } = {}) {
  if (!baseNames) return null;
  
  // Normalize to array
  const names = Array.isArray(baseNames) ? baseNames : [baseNames];
  
  const { logosDir, logosPrefix } = getAssetConfig();
  const extensions = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
  
  for (const baseName of names) {
    if (!baseName || typeof baseName !== 'string') continue;
    
    for (const ext of extensions) {
      const fileName = `${baseName}${ext}`;
      const fullPath = path.join(logosDir, fileName);
      try {
        if (fs.existsSync(fullPath)) {
          return `${logosPrefix}/${fileName}`;
        }
      } catch (e) { 
        continue; 
      }
    }
  }
  
  return null;
}

// Backward compatibility aliases (if needed by internal calls)
export function getFlagPath({ teamName } = {}) {
  const { flagsDir, flagsPrefix } = getAssetConfig();
  return resolveFilePath(teamName, flagsDir, flagsPrefix.replace(/^\//, ''));
}
