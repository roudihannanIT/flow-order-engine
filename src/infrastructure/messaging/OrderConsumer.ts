import { rabbitMQClient } from './rabbitmqClient.js';
import { PrismaOrderRepository } from '../repositories/PrismaOrderRepository.js';
import { OrderStatus } from '@prisma/client';

const orderRepository = new PrismaOrderRepository();

// If the channel died while a message was being processed, ack/nack throws.
// That is safe to ignore: RabbitMQ redelivers every unacknowledged message of a closed channel.
const settle = (action: () => void): void => {
  try {
    action();
  } catch (error) {
    console.warn(
      'Could not ack/nack the message (channel closed). RabbitMQ will redeliver it:',
      error,
    );
  }
};

export class OrderConsumer {
  private static consumerTag: string | null = null;
  private static inFlight = 0;

  // Errors are intentionally not swallowed here: if the consumer cannot start, the caller must know
  public static async consumeOrderCreated(): Promise<void> {
    const channel = rabbitMQClient.getChannel();

    // Setting the prefetch (QoS) to process messages smoothly without overloading the server
    await channel.prefetch(10);

    console.log(`Waiting for messages in queue: ${rabbitMQClient.MAIN_QUEUE}...`);

    // Starting to listen for incoming messages
    const { consumerTag } = await channel.consume(
      rabbitMQClient.MAIN_QUEUE,
      async (msg) => {
        if (!msg) return;

        OrderConsumer.inFlight++;
        try {
          const eventContent = JSON.parse(msg.content.toString());
          console.log(
            `Received [${eventContent.event}] event for order ID: ${eventContent.data?.id}`,
          );

          const orderId = eventContent.data?.id;
          const currentVersion = eventContent.data?.version;

          if (!orderId) {
            throw new Error('Invalid message payload: Order ID is missing.');
          }

          // Updating the order status in the database to PROCESSING
          await orderRepository.updateStatus(orderId, OrderStatus.PROCESSING, currentVersion);
          console.log(`Order status updated to PROCESSING for ID: ${orderId}`);

          // Confirming successful processing
          settle(() => channel.ack(msg));
        } catch (error) {
          console.error('Error processing message. Routing to Dead Letter Queue (DLQ):', error);

          // requeue: false automatically routes the message to the DLQ defined in rabbitmqClient
          settle(() => channel.nack(msg, false, false));
        } finally {
          OrderConsumer.inFlight--;
        }
      },
      { noAck: false },
    );

    OrderConsumer.consumerTag = consumerTag;
  }

  // Graceful stop: stop receiving new messages, then wait for the ones already being processed
  public static async stop(timeoutMs = 4000): Promise<void> {
    const consumerTag = OrderConsumer.consumerTag;
    OrderConsumer.consumerTag = null;

    if (consumerTag && rabbitMQClient.isConnected()) {
      await rabbitMQClient.getChannel().cancel(consumerTag);
    }

    const deadline = Date.now() + timeoutMs;
    while (OrderConsumer.inFlight > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (OrderConsumer.inFlight > 0) {
      console.warn(
        `${OrderConsumer.inFlight} message(s) still in flight. RabbitMQ will redeliver them.`,
      );
    }
  }
}
