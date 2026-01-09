import { competitionHub } from '../index.js';

/**
 * Return a numeric or string version id for the hub/fop used in cache keys.
 * If a plugin is tied to a specific FOP, pass the fopName and includeFop=true
 * (default) when building cache keys. If a plugin is not tied to any FOP
 * (document-style plugins), pass includeFop=false to avoid per-FOP keys.
 * 
 * IMPORTANT: Uses lastDataUpdate timestamp to detect data changes.
 * Timer/decision events do NOT update lastDataUpdate, only actual data updates do.
 * This ensures timer events don't invalidate cached scoreboard data.
 */
export function getHubFopVersion(fopName) {
    try {
        if (fopName) {
            const fop = competitionHub.getFopUpdate({ fopName });
            if (fop) {
                // Use lastDataUpdate (not lastUpdate) - this only changes on actual data updates,
                // not on timer/decision events. This is the correct cache invalidation key.
                if (fop.lastDataUpdate) {
                    return fop.lastDataUpdate;
                }
                // Fallback to lastUpdate if lastDataUpdate not set
                if (fop.lastUpdate) {
                    return fop.lastUpdate;
                }
                // Legacy fields (from older hub implementations)
                if (fop.fopVersion || fop.fopStateVersion || fop.version) {
                    return fop.fopVersion || fop.fopStateVersion || fop.version;
                }
            }
        }
    } catch (e) {
        // swallow errors and fall back
    }

    try {
        const db = competitionHub.getDatabaseState();
        if (db && db.hubVersion) return db.hubVersion;
        if (db && db.lastUpdate) return db.lastUpdate;
    } catch (e) {
        // swallow
    }

    // final fallback
    return 0;
}

/**
 * Normalize a value for canonical cache key representation
 */
function canonicalValue(v) {
    if (v === true || v === 'true') return 'true';
    if (v === false || v === 'false') return 'false';
    if (v == null) return 'null';
    
    const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() && !isNaN(v) ? Number(v) : null);
    if (n !== null && Number.isFinite(n)) return String(Object.is(n, -0) ? 0 : n);
    
    return typeof v === 'string' ? v.normalize('NFKC') : String(v);
}

/**
 * Build a cache key. If includeFop is false, the fopName will be omitted
 * and the key will be global to the hub. Options are normalized and sorted
 * alphabetically by key for stable cache keys.
 */
export function buildCacheKey({ fopName, includeFop = true, opts = {} } = {}) {
    const version = getHubFopVersion(includeFop ? fopName : null);
    
    // Sort options keys alphabetically and normalize values for canonical representation
    const sortedOpts = Object.keys(opts).length > 0
        ? JSON.stringify(
            Object.keys(opts)
                .sort((a, b) => a.localeCompare(b))
                .reduce((acc, key) => {
                    acc[key] = canonicalValue(opts[key]);
                    return acc;
                }, {})
          )
        : '';
    
    if (includeFop) {
        return `${fopName}-v${version}-${sortedOpts}`;
    }
    return `global-v${version}-${sortedOpts}`;
}
