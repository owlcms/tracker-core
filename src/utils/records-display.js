/**
 * Records Display and Sorting Utilities
 * 
 * Provides formatting and sorting helpers for competition records:
 * - formatCategoryDisplay: Display weight categories with "+" for superheavyweights
 * - sortRecordsList: Sort records by weight class, lift type, and record name
 */

const liftPriority = {
  SNATCH: 1,
  CLEANJERK: 2,
  TOTAL: 3
};

/**
 * Format category display string
 * Replaces ">" prefix with "+" for superheavyweight categories
 * 
 * @param {string} category - Category string (e.g., ">87", "81", "F64")
 * @returns {string} Formatted category (e.g., "+87", "81", "F64")
 */
export function formatCategoryDisplay(category = '') {
  if (!category) return '';
  return category.startsWith('>') ? `+${category.slice(1)}` : category;
}

/**
 * Parse numeric upper bound from category data
 * Handles both numeric values and string formats
 * 
 * @param {number|string} candidate - Category upper bound
 * @returns {number} Numeric upper bound or MAX_SAFE_INTEGER for superheavyweights
 */
function parseUpperBound(candidate) {
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === 'string') {
    const matches = candidate.match(/\d+(?:\.\d+)?/);
    if (matches) {
      return parseFloat(matches[0]);
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Compare two records for sorting
 * Sort order:
 * 1. Weight class (bwCatUpper) ascending, superheavyweights last
 * 2. Category code alphabetically
 * 3. Lift type (Snatch → Clean & Jerk → Total)
 * 4. Record name alphabetically
 * 
 * @param {Object} a - First record
 * @param {Object} b - Second record
 * @returns {number} Comparison result (-1, 0, 1)
 */
function compareRecords(a, b) {
  const upperA = parseUpperBound(a.bwCatUpper);
  const upperB = parseUpperBound(b.bwCatUpper);
  if (upperA !== upperB) {
    return upperA - upperB;
  }

  const categoryCompare = (a.categoryCode || '').localeCompare(b.categoryCode || '');
  if (categoryCompare !== 0) {
    return categoryCompare;
  }

  const liftA = (a.lift || '').toUpperCase();
  const liftB = (b.lift || '').toUpperCase();
  const orderA = liftPriority[liftA] || 99;
  const orderB = liftPriority[liftB] || 99;
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return (a.recordName || '').localeCompare(b.recordName || '');
}

/**
 * Sort array of records
 * Returns a new sorted array without mutating the original
 * 
 * @param {Array} records - Array of record objects
 * @returns {Array} Sorted array of records
 */
export function sortRecordsList(records = []) {
  return [...records].sort(compareRecords);
}
