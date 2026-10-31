import test from 'node:test';
import assert from 'node:assert';
import { createOrderSchema } from './orderSchemas.js';

const validBody = {
  customerId: 'cust_1',
  idempotencyKey: 'key-12345',
  items: [{ productId: 'prod_1', quantity: 2, price: 9.99 }],
};

test('createOrderSchema: accepts a valid body', () => {
  assert.ok(createOrderSchema.safeParse(validBody).success);
});

test('createOrderSchema: trims whitespace from strings', () => {
  const result = createOrderSchema.safeParse({ ...validBody, customerId: '  cust_1  ' });
  assert.ok(result.success);
  assert.strictEqual(result.data.customerId, 'cust_1');
});

test('createOrderSchema: rejects a missing body', () => {
  assert.strictEqual(createOrderSchema.safeParse(undefined).success, false);
});

test('createOrderSchema: rejects an empty items array', () => {
  assert.strictEqual(createOrderSchema.safeParse({ ...validBody, items: [] }).success, false);
});

test('createOrderSchema: rejects a negative or fractional quantity', () => {
  for (const quantity of [-1, 0, 1.5]) {
    const body = { ...validBody, items: [{ productId: 'prod_1', quantity, price: 10 }] };
    assert.strictEqual(createOrderSchema.safeParse(body).success, false, `quantity ${quantity}`);
  }
});

test('createOrderSchema: rejects a price sent as a string or a non-positive number', () => {
  for (const price of ['10', 0, -5]) {
    const body = { ...validBody, items: [{ productId: 'prod_1', quantity: 1, price }] };
    assert.strictEqual(createOrderSchema.safeParse(body).success, false, `price ${String(price)}`);
  }
});

test('createOrderSchema: rejects unknown fields (mass assignment protection)', () => {
  const result = createOrderSchema.safeParse({ ...validBody, totalAmount: 1 });
  assert.strictEqual(result.success, false);
});

test('createOrderSchema: rejects a short idempotency key', () => {
  assert.strictEqual(createOrderSchema.safeParse({ ...validBody, idempotencyKey: 'x' }).success, false);
});