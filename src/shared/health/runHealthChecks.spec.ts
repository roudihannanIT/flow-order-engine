import test from 'node:test';
import assert from 'node:assert';
import { runHealthChecks } from './runHealthChecks.js';

test('runHealthChecks: reports ok when every dependency is up', async () => {
  const report = await runHealthChecks({
    database: async () => {},
    redis: async () => {},
  });

  assert.deepStrictEqual(report, {
    status: 'ok',
    checks: { database: 'up', redis: 'up' },
  });
});

test('runHealthChecks: reports degraded when a dependency throws', async () => {
  const report = await runHealthChecks({
    database: async () => {},
    redis: async () => {
      throw new Error('connection refused');
    },
  });

  assert.strictEqual(report.status, 'degraded');
  assert.deepStrictEqual(report.checks, { database: 'up', redis: 'down' });
});

test('runHealthChecks: treats a check that never settles as down (timeout)', async () => {
  const report = await runHealthChecks({ redis: () => new Promise<void>(() => {}) }, 50);

  assert.strictEqual(report.status, 'degraded');
  assert.strictEqual(report.checks.redis, 'down');
});
