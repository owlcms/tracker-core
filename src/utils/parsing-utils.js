/**
 * Parsing Utilities
 * 
 * Functions for parsing and normalizing data values from OWLCMS.
 */

/**
 * Parse a formatted number that may be a string with decimal comma or point.
 * Handles European-style comma decimals (e.g., "123,45") and standard decimals.
 * 
 * @param {*} value - Value to parse (string, number, null, undefined)
 * @returns {number} Parsed number or 0 if invalid
 * 
 * @example
 * parseFormattedNumber("123.45")  // → 123.45
 * parseFormattedNumber("123,45")  // → 123.45 (European format)
 * parseFormattedNumber(123.45)    // → 123.45
 * parseFormattedNumber("")        // → 0
 * parseFormattedNumber("-")       // → 0
 * parseFormattedNumber(null)      // → 0
 */
export function parseFormattedNumber(value) {
	if (value === null || value === undefined || value === '' || value === '-') {
		return 0;
	}
	if (typeof value === 'number') {
		return value;
	}
	const normalized = String(value).replace(',', '.');
	const parsed = parseFloat(normalized);
	return isNaN(parsed) ? 0 : parsed;
}
