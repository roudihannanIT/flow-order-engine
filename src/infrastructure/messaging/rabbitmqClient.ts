import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

class RabbitMQClient {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;

  // Definition of the main Exchanges, Queues, and DLQ names
  public readonly MAIN_EXCHANGE = 'order_events';
  public readonly MAIN_QUEUE = 'order_queue';
  public readonly ROUTING_KEY = 'order.created';

  public readonly DLX_EXCHANGE = 'order_dlx';
  public readonly DLQ_QUEUE = 'order_dlq';
  public readonly DLQ_ROUTING_KEY = 'order.dead_letter';

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  }

  public async connect(retries = 5, delay = 3000): Promise<void> {
    for (let i = 1; i <= retries; i++) {
      try {
        this.connection = await amqp.connect(this.url);
        this.channel = await this.connection.createChannel();

        console.log('Connected to RabbitMQ successfully');

        // Configuring the DLQ and Main Queues
        await this.setupExchangesAndQueues();

        this.connection.on('close', (error: unknown) => {
          console.error('RabbitMQ connection closed:', error);
          this.channel = null;
          this.connection = null;
        });
        return;
      } catch (error) {
        console.warn(`Attempt ${i}/${retries} failed to connect to RabbitMQ. Retrying in ${delay / 1000}s...`);
        if (i === retries) {
          console.error('Failed to connect to RabbitMQ after maximum retries.');
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Setting up the Exchanges and Queues with DLQ binding
  private async setupExchangesAndQueues(): Promise<void> {
    if (!this.channel) return;

    // 1. Creating a Dead Letter Exchange and a Dead Letter Queue
    await this.channel.assertExchange(this.DLX_EXCHANGE, 'direct', { durable: true });
    await this.channel.assertQueue(this.DLQ_QUEUE, { durable: true });
    await this.channel.bindQueue(this.DLQ_QUEUE, this.DLX_EXCHANGE, this.DLQ_ROUTING_KEY);

    // 2. Creating the Main Exchange
    await this.channel.assertExchange(this.MAIN_EXCHANGE, 'topic', { durable: true });

    // 3. Creating the Main Queue and routing failed messages to the DLX
    await this.channel.assertQueue(this.MAIN_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': this.DLX_EXCHANGE,
        'x-dead-letter-routing-key': this.DLQ_ROUTING_KEY,
      },
    });

    // 4. Binding the Main Queue to the Main Exchange
    await this.channel.bindQueue(this.MAIN_QUEUE, this.MAIN_EXCHANGE, this.ROUTING_KEY);

    console.log('RabbitMQ Exchanges and Queues (including DLQ) setup completed.');
  }

  public getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized. Call connect() first.');
    }
    return this.channel;
  }

  public async close(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      console.log('RabbitMQ connection closed gracefully');
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
  }
}

export const rabbitMQClient = new RabbitMQClient();