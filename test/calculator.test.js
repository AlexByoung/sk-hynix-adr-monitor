import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSpread, quoteAgeMinutes } from '../calculator.js';

test('calculates the 10 ADR to 1 ordinary share conversion', () => {
  const result = calculateSpread({ adrUsd: 140, krxKrw: 1_800_000, usdKrw: 1_500 });
  assert.equal(result.fairValueUsd, 120);
  assert.ok(Math.abs(result.premiumPct - 16.6666667) < 0.0001);
  assert.equal(result.absoluteGapUsd, 20);
});

test('rejects zero or invalid prices', () => {
  assert.throws(() => calculateSpread({ adrUsd: 0, krxKrw: 1, usdKrw: 1 }), /adrUsd/);
});

test('computes quote age', () => {
  assert.equal(quoteAgeMinutes(1_000, 1_060_000), 1);
});
