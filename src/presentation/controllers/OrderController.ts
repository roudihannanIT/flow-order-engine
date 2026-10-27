import { Request, Response, NextFunction } from 'express';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase.js';
import { PrismaOrderRepository } from '../../infrastructure/repositories/PrismaOrderRepository.js';

const orderRepository = new PrismaOrderRepository();
const createOrderUseCase = new CreateOrderUseCase(orderRepository);

export class OrderController {
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerId, idempotencyKey, items } = req.body;

      // Invoking the Use Case for order creation with support for idempotency
      const order = await createOrderUseCase.execute({
        customerId,
        idempotencyKey,
        items,
        totalAmount: 0, // It will be calculated automatically within the Use Case.
      });

      res.status(201).json({
        status: 'success',
        message: 'Order processed successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }
}