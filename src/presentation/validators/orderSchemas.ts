import { z } from 'zod';

const orderItemSchema = z.strictObject({
  productId: z.string().trim().min(1).max(100),
  quantity: z.number().int().positive().max(100),
  price: z.number().positive().max(10000),
});

export const createOrderSchema = z.strictObject({
  customerId: z.string().trim().min(1).max(100),
  idempotencyKey: z.string().trim().min(8).max(100),
  items: z.array(orderItemSchema).min(1).max(50),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;