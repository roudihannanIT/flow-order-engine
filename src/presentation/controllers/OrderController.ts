import { Request, Response, NextFunction } from 'express';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase.js';
import { PrismaOrderRepository } from '../../infrastructure/repositories/PrismaOrderRepository.js';
import { OrderEventPublisher } from '../../infrastructure/messaging/OrderEventPublisher.js';

const orderRepository = new PrismaOrderRepository();
const createOrderUseCase = new CreateOrderUseCase(orderRepository);

export class OrderController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerId, idempotencyKey, items } = req.body;

      // Creating an Order via a Use Case
      const order = await createOrderUseCase.execute({
        customerId,
        idempotencyKey,
        items,
        totalAmount: 0,
      });

      // Publish the OrderCreated event asynchronously via RabbitMQ
      await OrderEventPublisher.publishOrderCreated(order);

      res.status(201).json({
        status: 'success',
        message: 'Order processed and event published successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
}