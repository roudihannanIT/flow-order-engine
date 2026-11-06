import test from 'node:test';
import assert from 'node:assert';
import { toCents, fromCents, hasAtMostTwoDecimals } from './money.js';

test('toCents: converts amounts to integer cents without drift', () => {
  assert.strictEqual(toCents(19.99), 1999);
  assert.strictEqual(toCents(0.1), 10);
  assert.strictEqual(toCents(1.15), 115);
});

test('fromCents: converts integer cents back to an amount', () => {
  assert.strictEqual(fromCents(1999), 19.99);
  assert.strictEqual(fromCents(30), 0.3);
});

test('hasAtMostTwoDecimals: accepts cents precision and rejects finer amounts', () => {
  for (const value of [10, 9.99, 0.1, 0.01]) {
    assert.ok(hasAtMostTwoDecimals(value), `${value} should be accepted`);
  }
  for (const value of [9.999, 0.004, 1.005]) {
    assert.ok(!hasAtMostTwoDecimals(value), `${value} should be rejected`);
  }
});
