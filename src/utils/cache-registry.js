/**
 * Global cache registry for coordinated cache invalidation
 * 
 * Plugins register their caches here so they can be cleared atomically
 * when a refresh is triggered.
 */

let cacheEpoch = 0;

/** @type {Set<Map<any, any>>} */
const registeredCaches = new Set();

/**
 * Get current cache epoch value
 * @returns {number}
 */
export function getCacheEpoch() {
	return cacheEpoch;
}

/**
 * Register a cache Map to be cleared when epoch bumps.
 * Call this once per cache at module load time.
 * @param {Map<any, any>} cacheMap
 */
export function registerCache(cacheMap) {
	registeredCaches.add(cacheMap);
}

/**
 * Unregister a cache (for cleanup)
 * @param {Map<any, any>} cacheMap
 */
export function unregisterCache(cacheMap) {
	registeredCaches.delete(cacheMap);
}

/**
 * Bump the epoch and clear all registered caches.
 * Returns the new epoch value.
 * @returns {number}
 */
export function bumpCacheEpoch() {
	cacheEpoch += 1;
	let totalCleared = 0;
	for (const cache of registeredCaches) {
		totalCleared += cache.size;
		cache.clear();
	}
	if (totalCleared > 0) {
		console.log(`[CacheEpoch] Cleared ${totalCleared} entries from ${registeredCaches.size} caches`);
	}
	return cacheEpoch;
}

/**
 * Get count of registered caches
 * @returns {number}
 */
export function getRegisteredCacheCount() {
	return registeredCaches.size;
}
