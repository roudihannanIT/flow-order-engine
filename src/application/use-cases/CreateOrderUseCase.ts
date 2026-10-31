import { IOrderRepository, CreateOrderDTO } from '../../domain/repositories/IOrderRepository.js';
import { Order } from '@prisma/client';
import { DuplicateIdempotencyKeyError } from '../../domain/errors/DuplicateIdempotencyKeyError.js';

export interface CreateOrderResult {
  order: Order;
  // true when a new order was persisted, false when an existing one was returned (idempotent replay)
  created: boolean;
}

export class CreateOrderUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(data: CreateOrderDTO): Promise<CreateOrderResult> {
    // Checking whether the request has already been created using an idempotency key
    const existingOrder = await this.orderRepository.findByIdempotencyKey(data.idempotencyKey);

    if (existingOrder) {
      // Idempotent behavior: return the existing order without creating a new one
      return { order: existingOrder, created: false };
    }

    // Calculating the grand total from the items instead of trusting the client
    const calculatedTotal = data.items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    try {
      const newOrder = await this.orderRepository.create({
        ...data,
        totalAmount: calculatedTotal,
      });
      return { order: newOrder, created: true };
    } catch (error) {
      // A concurrent request with the same key inserted first: treat this one as an idempotent replay
      if (error instanceof DuplicateIdempotencyKeyError) {
        const winner = await this.orderRepository.findByIdempotencyKey(data.idempotencyKey);
        if (winner) {
          return { order: winner, created: false };
        }
      }
      throw error;
    }
  }
}