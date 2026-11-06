import test from 'node:test';
import assert from 'node:assert';
import { runShutdownSteps } from './runShutdownSteps.js';

test('runShutdownSteps: runs the steps sequentially in the given order', async () => {
  const order: string[] = [];

  await runShutdownSteps([
    {
      name: 'http',
      run: async () => {
        // The slowest step comes first: parallel execution would finish it last
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push('http');
      },
    },
    { name: 'consumer', run: async () => void order.push('consumer') },
    { name: 'database', run: async () => void order.push('database') },
  ]);

  assert.deepStrictEqual(order, ['http', 'consumer', 'database']);
});

test('runShutdownSteps: keeps going when a step fails', async () => {
  const order: string[] = [];

  await runShutdownSteps([
    {
      name: 'rabbitmq',
      run: async () => {
        throw new Error('close failed');
      },
    },
    { name: 'redis', run: async () => void order.push('redis') },
  ]);

  assert.deepStrictEqual(order, ['redis']);
});

test('runShutdownSteps: does not wait forever for a step that hangs', async () => {
  const order: string[] = [];

  await runShutdownSteps(
    [
      { name: 'stuck', run: () => new Promise<void>(() => {}) },
      { name: 'database', run: async () => void order.push('database') },
    ],
    50,
  );

  assert.deepStrictEqual(order, ['database']);
});
