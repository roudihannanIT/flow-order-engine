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

      const { order, created } = await createOrderUseCase.execute({
        customerId,
        idempotencyKey,
        items,
        totalAmount: 0,
      });

      // Publish the event only for newly created orders; a replayed request must not emit a duplicate event
      if (created) {
        await OrderEventPublisher.publishOrderCreated(order);
      }

      res.status(created ? 201 : 200).json({
        status: 'success',
        message: created
          ? 'Order created successfully'
          : 'Order already exists for this idempotency key',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
}