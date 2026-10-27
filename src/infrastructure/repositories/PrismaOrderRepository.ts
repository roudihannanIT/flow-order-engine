import { IOrderRepository, CreateOrderDTO } from '../../domain/repositories/IOrderRepository.js';
import { Order, OrderStatus } from '@prisma/client';
import { prisma } from '../database/prismaClient.js';

export class PrismaOrderRepository implements IOrderRepository {
  async create(data: CreateOrderDTO): Promise<Order> {
    return prisma.order.create({
      data: {
        customerId: data.customerId,
        totalAmount: data.totalAmount,
        idempotencyKey: data.idempotencyKey,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async findById(id: string): Promise<Order | null> {
    return prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
  }

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    return prisma.order.findUnique({
      where: { idempotencyKey: key },
      include: { items: true },
    });
  }

  async updateStatus(id: string, status: OrderStatus, version: number): Promise<Order> {
    // Implementing optimistic locking by verifying and updating the current version
    const updated = await prisma.order.updateMany({
      where: { id, version },
      data: {
        status,
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new Error('Concurrency conflict: Order was modified or processed by another transaction.');
    }

    const order = await this.findById(id);
    if (!order) {
      throw new Error('Order not found after update');
    }
    return order;
  }
}