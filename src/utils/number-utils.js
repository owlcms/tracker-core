/**
 * Parse formatted numbers with European decimal commas or standard decimals
 * 
 * @param {string|number} value - Number string or number
 * @returns {number} Parsed number (0 if invalid)
 */
export function parseFormattedNumber(value) {
	if (typeof value === 'number') return value;
	if (!value || value === '-' || value === '') return 0;
	
	// Convert European comma decimal to dot
	const normalized = String(value).replace(',', '.');
	const parsed = parseFloat(normalized);
	
	return isNaN(parsed) ? 0 : parsed;
}
