import { rabbitMQClient } from './rabbitmqClient.js';

export class OrderEventPublisher {
  private static readonly EXCHANGE_NAME = 'order_events';

  public static async publishOrderCreated(order: any): Promise<void> {
    try {
      const channel = rabbitMQClient.getChannel();
      
      // Ensure that the Exchange is created as either a 'fanout' or 'topic' type.
      await channel.assertExchange(this. EXCHANGE_NAME, 'topic', { durable: true });

      const routingKey = 'order.created';
      const payload = Buffer.from(JSON.stringify({
        event: 'OrderCreated',
        timestamp: new Date().toISOString(),
        data: order,
      }));

      channel.publish(this.EXCHANGE_NAME, routingKey, payload, { persistent: true });
      console.log(`Published [OrderCreated] event for order ID: ${order.id}`);
    } catch (error) {
      console.error('Failed to publish OrderCreated event:', error);
      // We do not stop the primary request if the event publication fails, but we do log the error.
    }
  }
}