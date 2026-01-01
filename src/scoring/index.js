/**
 * Scoring Formulas
 * 
 * Exports scoring calculation functions:
 * - Sinclair 2020 and 2024
 * - QPoints
 * - GAMX and GAMX2
 * - Team points calculation
 */

export { calculateSinclair2024, calculateSinclair2020, getMastersAgeFactor } from './sinclair-coefficients.js';
export { calculateQPoints } from './qpoints-coefficients.js';
export { calculateGamx, Variant } from './gamx2.js';
export { calculateTeamPoints } from './team-points-formula.js';
