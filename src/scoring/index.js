/**
 * Scoring Formulas
 * 
 * Exports scoring calculation functions:
 * - Sinclair 2020, 2024, and 2028
 * - QPoints
 * - GAMX and GAMX2
 * - Team points calculation
 */

export {
	calculateSinclair,
	calculateSinclair2020,
	calculateSinclair2024,
	calculateSinclair2028,
	calculateSinclairMasters,
	getMastersAgeFactor,
	normalizeMastersAgeFactorYear,
	normalizeSinclairYear
} from './sinclair-coefficients.js';
export { calculateQPoints, getQPointsAgeFactor } from './qpoints-coefficients.js';
export { calculateGamx, Variant } from './gamx2.js';
export { calculateTeamPoints } from './team-points-formula.js';
