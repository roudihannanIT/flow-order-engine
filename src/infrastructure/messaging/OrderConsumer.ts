import { rabbitMQClient } from './rabbitmqClient.js';
import { PrismaOrderRepository } from '../repositories/PrismaOrderRepository.js';
import { OrderStatus } from '@prisma/client';

const orderRepository = new PrismaOrderRepository();

export class OrderConsumer {
  private static readonly EXCHANGE_NAME = 'order_events';
  private static readonly QUEUE_NAME = 'order_processing_queue';

  public static async consumeOrderCreated(): Promise<void> {
    try {
      const channel = rabbitMQClient.getChannel();

      // Ensure that the exchange and the queue are created and linked together.
      await channel.assertExchange(this.EXCHANGE_NAME, 'topic', { durable: true });
      const q = await channel.assertQueue(this.QUEUE_NAME, { durable: true });

      // Binding the queue to the exchange using the appropriate routing key
      await channel.bindQueue(q.queue, this.EXCHANGE_NAME, 'order.created');

      console.log(`👂 Waiting for messages in queue: ${q.queue}...`);

      // Start listening to incoming messages
      channel.consume(q.queue, async (msg) => {
        if (msg) {
          try {
            const eventContent = JSON.parse(msg.content.toString());
            console.log(`Received [${eventContent.event}] event for order ID: ${eventContent.data.id}`);

            // Event processing: for example, updating the order status to PROCESSING in the background
            const orderId = eventContent.data.id;
            const currentVersion = eventContent.data.version;

            await orderRepository.updateStatus(orderId, OrderStatus.PROCESSING, currentVersion);
            console.log(`Order status updated to PROCESSING for ID: ${orderId}`);

            // Acknowledge successful processing
            channel.ack(msg);
          } catch (error) {
            console.error('Error processing message:', error);
            // Return the message to the queue, or reject it without requeuing if the error persists (requeue: false)
            channel.nack(msg, false, false);
          }
        }
      }, { noAck: false });

    } catch (error) {
      console.error('Failed to start OrderConsumer:', error);
    }
  }
}