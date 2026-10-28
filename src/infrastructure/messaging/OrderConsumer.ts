import { rabbitMQClient } from './rabbitmqClient.js';
import { PrismaOrderRepository } from '../repositories/PrismaOrderRepository.js';
import { OrderStatus } from '@prisma/client';

const orderRepository = new PrismaOrderRepository();

export class OrderConsumer {
  public static async consumeOrderCreated(): Promise<void> {
    try {
      const channel = rabbitMQClient.getChannel();

      // Setting the prefetch (QoS) to process messages smoothly without overloading the server
      await channel.prefetch(10);

      console.log(`Waiting for messages in queue: ${rabbitMQClient.MAIN_QUEUE}...`);

      // Starting to listen for incoming messages
      channel.consume(
        rabbitMQClient.MAIN_QUEUE,
        async (msg) => {
          if (!msg) return;

          try {
            const eventContent = JSON.parse(msg.content.toString());
            console.log(`Received [${eventContent.event}] event for order ID: ${eventContent.data?.id}`);

            const orderId = eventContent.data?.id;
            const currentVersion = eventContent.data?.version;

            if (!orderId) {
              throw new Error('Invalid message payload: Order ID is missing.');
            }

            // Updating the order status in the database to PROCESSING
            await orderRepository.updateStatus(orderId, OrderStatus.PROCESSING, currentVersion);
            console.log(`Order status updated to PROCESSING for ID: ${orderId}`);

            // Confirming successful processing
            channel.ack(msg);
          } catch (error) {
            console.error('Error processing message. Routing to Dead Letter Queue (DLQ):', error);

            // requeue: false automatically routes the message to the DLQ defined in rabbitmqClient
            channel.nack(msg, false, false);
          }
        },
        { noAck: false }
      );
    } catch (error) {
      console.error('Failed to start OrderConsumer:', error);
    }
  }
}