import test from 'node:test';
import assert from 'node:assert';
import { CreateOrderUseCase } from './CreateOrderUseCase.js';
import { IOrderRepository } from '../../domain/repositories/IOrderRepository.js';
import { OrderStatus } from '@prisma/client';

// Mock implementation of IOrderRepository for testing purposes
class MockOrderRepository implements IOrderRepository {
  private orders: any[] = [];

  async create(orderData: any): Promise<any> {
    const newOrder = {
      id: 'mock-id-' + Math.random(),
      ...orderData,
      status: OrderStatus.PENDING,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.push(newOrder);
    return newOrder;
  }

  async findByIdempotencyKey(key: string): Promise<any | null> {
    return this.orders.find(o => o.idempotencyKey === key) || null;
  }

  async findById(id: string): Promise<any | null> {
    return this.orders.find(o => o.id === id) || null;
  }

  async updateStatus(id: string, status: any, version: number): Promise<any> {
    const order = this.orders.find(o => o.id === id);
    if (!order) throw new Error('Order not found');
    order.status = status;
    order.version += 1;
    return order;
  }
}

test('CreateOrderUseCase: should successfully create a new order when idempotency key is unique', async () => {
  const orderRepository = new MockOrderRepository();
  const createOrderUseCase = new CreateOrderUseCase(orderRepository);

  const orderData = {
    customerId: 'cust_unit_test',
    idempotencyKey: 'key-test-123',
    totalAmount: 150,
    items: [{ productId: 'prod_1', quantity: 3, price: 50 }],
  };

  const result = await createOrderUseCase.execute(orderData);

  assert.ok(result);
  assert.strictEqual(result.customerId, 'cust_unit_test');
  assert.strictEqual(result.totalAmount, 150);
  assert.strictEqual(result.status, OrderStatus.PENDING);
});

test('CreateOrderUseCase: should return existing order if idempotency key is reused (Idempotency check)', async () => {
  const orderRepository = new MockOrderRepository();
  const createOrderUseCase = new CreateOrderUseCase(orderRepository);

  const orderData = {
    customerId: 'cust_unit_test',
    idempotencyKey: 'key-duplicate-999',
    totalAmount: 200,
    items: [{ productId: 'prod_2', quantity: 2, price: 100 }],
  };

  const firstCall = await createOrderUseCase.execute(orderData);
  const secondCall = await createOrderUseCase.execute(orderData);

  assert.strictEqual(secondCall.id, firstCall.id);
});