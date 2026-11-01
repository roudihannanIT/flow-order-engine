import { z } from 'zod';
import { hasAtMostTwoDecimals } from '../../domain/money.js';

const orderItemSchema = z.strictObject({
  productId: z.string().trim().min(1).max(100),
  quantity: z.number().int().positive().max(100),
  price: z
  .number()
  .positive()
  .max(10000)
  .refine(hasAtMostTwoDecimals, {message: 'Price must have at most two decimal places'}),
});

export const createOrderSchema = z.strictObject({
  customerId: z.string().trim().min(1).max(100),
  idempotencyKey: z.string().trim().min(8).max(100),
  items: z.array(orderItemSchema).min(1).max(50),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;