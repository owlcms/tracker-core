import fs from 'fs';
import path from 'path';

const COUNTRY_CODE_MAP_FILE_NAME = 'country-code-map.json';

let cachedCountryCodeMap = null;

const EMPTY_COUNTRY_CODE_MAP = {
  countryToIoc: {},
  normalizedCountryToIoc: {},
  iocToCountry: {},
  isoToCountry: {},
  isoToIoc: {},
  flagAliasToCode: {},
  normalizedFlagAliasToCode: {},
  flagCodeToName: {},
  subdivisionCodeToName: {}
};

function resolveLocalMappingsPath() {
  const hub = globalThis.__competitionHub;
  const baseDir = typeof hub?.getLocalFilesDir === 'function' && hub.getLocalFilesDir()
    ? hub.getLocalFilesDir()
    : path.join(process.cwd(), 'local');

  return path.join(baseDir, 'mappings', COUNTRY_CODE_MAP_FILE_NAME);
}

function normalizeCountryLookupKey(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getCountryCodeMap() {
  if (!cachedCountryCodeMap) {
    const localMappingsPath = resolveLocalMappingsPath();
    cachedCountryCodeMap = fs.existsSync(localMappingsPath)
      ? JSON.parse(fs.readFileSync(localMappingsPath, 'utf8'))
      : EMPTY_COUNTRY_CODE_MAP;
  }

  return cachedCountryCodeMap;
}

export function invalidateCountryCodeMapCache() {
  cachedCountryCodeMap = null;
}

export function lookupIocCode(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const map = getCountryCodeMap();
  const upperValue = trimmedValue.toUpperCase();

  if (/^[A-Z0-9]{3}$/.test(upperValue)) {
    if (map.iocToCountry[upperValue]) {
      return upperValue;
    }

    return map.isoToIoc[upperValue] || null;
  }

  return map.countryToIoc[trimmedValue] || map.normalizedCountryToIoc[normalizeCountryLookupKey(trimmedValue)] || null;
}

export function lookupFlagCode(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const map = getCountryCodeMap();
  const upperValue = trimmedValue.toUpperCase();

  if (map.flagCodeToName[upperValue]) {
    return upperValue;
  }

  if (/^[A-Z0-9]{3}$/.test(upperValue) && map.isoToIoc[upperValue]) {
    return map.isoToIoc[upperValue];
  }

  return map.flagAliasToCode[trimmedValue] || map.normalizedFlagAliasToCode[normalizeCountryLookupKey(trimmedValue)] || null;
}

export function getCountryForIocCode(iocCode) {
  if (!iocCode || typeof iocCode !== 'string') return null;
  return getCountryCodeMap().iocToCountry[iocCode.trim().toUpperCase()] || null;
}

export function getCountryForIsoCode(isoCode) {
  if (!isoCode || typeof isoCode !== 'string') return null;
  return getCountryCodeMap().isoToCountry[isoCode.trim().toUpperCase()] || null;
}

export function getSubdivisionForCode(code) {
  if (!code || typeof code !== 'string') return null;
  return getCountryCodeMap().subdivisionCodeToName[code.trim().toUpperCase()] || null;
}