#!/usr/bin/env node

import assert from 'node:assert/strict';

import { formatCategoryDisplay } from '../src/utils/records-display.js';

assert.equal(formatCategoryDisplay('>110'), '+110');
assert.equal(formatCategoryDisplay('110+'), '+110');
assert.equal(formatCategoryDisplay('+110'), '+110');
assert.equal(formatCategoryDisplay('SR M >110'), 'SR M +110');
assert.equal(formatCategoryDisplay('SR M 110+'), 'SR M +110');
assert.equal(formatCategoryDisplay('110'), '110');

console.log('Records display tests passed');
