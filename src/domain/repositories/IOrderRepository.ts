import { Order, OrderStatus } from '@prisma/client';

export interface CreateOrderDTO {
  customerId: string;
  totalAmount: number;
  idempotencyKey: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
  }[];
}

export interface IOrderRepository {
  create(data: CreateOrderDTO): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByIdempotencyKey(key: string): Promise<Order | null>;
  updateStatus(id: string, status: OrderStatus, version: number): Promise<Order>;
}