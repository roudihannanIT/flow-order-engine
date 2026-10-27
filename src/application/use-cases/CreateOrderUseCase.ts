import { IOrderRepository, CreateOrderDTO } from '../../domain/repositories/IOrderRepository.js';
import { Order } from '@prisma/client';

export class CreateOrderUseCase {
  constructor(private orderRepository: IOrderRepository) {}

  async execute(data: CreateOrderDTO): Promise<Order> {
    // Checking whether the request has already been created using an idempotency key
    const existingOrder = await this.orderRepository.findByIdempotencyKey(data.idempotencyKey);
    
    if (existingOrder) {
      // Returning an existing request instead of creating a new one (Idempotent Behavior)
      return existingOrder;
    }

    // Calculating the grand total to verify the accuracy of the data
    const calculatedTotal = data.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);


    // Creating a new order via the warehouse
    const newOrder = await this.orderRepository.create({
      ...data,
      totalAmount: calculatedTotal,
    });

    return newOrder;
  }
}