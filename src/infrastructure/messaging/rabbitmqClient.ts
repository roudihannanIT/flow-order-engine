import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

class RabbitMQClient {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly url: string;

  private shuttingDown = false;
  private reconnecting = false;
  // Callbacks that run after every successful (re)connection, e.g. to restart consumers
  private readyListeners: Array<() => Promise<void>> = [];

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

  // Registers a callback that runs after the initial connection and after every automatic reconnection
  public onReady(listener: () => Promise<void>): void {
    this.readyListeners.push(listener);
  }

  public async connect(retries = 5, delay = 3000): Promise<void> {
    try {
      await this.openConnection(retries, delay);
    } catch (error) {
      console.error('Failed to connect to RabbitMQ after maximum retries.');
      throw error;
    }
    await this.notifyReady();
  }

  private async openConnection(retries: number, delay: number): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const connection = await amqp.connect(this.url);
        this.connection = connection;

        // Without an 'error' listener Node treats the emitted error as unhandled and crashes the process
        connection.on('error', (error: unknown) => {
          console.error('RabbitMQ connection error:', error);
        });

        connection.on('close', (error?: unknown) => {
          // Ignore events of a connection we already replaced or discarded
          if (this.connection !== connection) return;

          this.channel = null;
          this.connection = null;
          if (this.shuttingDown) return;

          console.error('RabbitMQ connection lost:', error);
          void this.reconnect();
        });

        const channel = await connection.createChannel();

        channel.on('error', (error: unknown) => {
          console.error('RabbitMQ channel error:', error);
        });

        channel.on('close', () => {
          // A channel that dies on its own leaves a half-working client: drop the whole connection
          // so the reconnect logic rebuilds everything from scratch
          if (!this.shuttingDown && this.channel === channel) {
            connection.close().catch(() => {});
          }
        });

        this.channel = channel;
        console.log('Connected to RabbitMQ successfully');

        // Configuring the DLQ and Main Queues
        await this.setupExchangesAndQueues();
        return;
      } catch (error) {
        await this.discardConnection();
        if (attempt === retries) throw error;
        console.warn(
          `Attempt ${attempt}/${retries} failed to connect to RabbitMQ. Retrying in ${delay / 1000}s...`,
        );
        await sleep(delay);
      }
    }
  }

  // Reconnects in the background with exponential backoff (2s, 4s, 8s ... capped at 30s)
  private async reconnect(): Promise<void> {
    if (this.reconnecting || this.shuttingDown) return;
    this.reconnecting = true;

    for (let attempt = 1; !this.shuttingDown; attempt++) {
      const wait = Math.min(1000 * 2 ** attempt, 30000);
      console.warn(`RabbitMQ reconnect attempt ${attempt} in ${wait / 1000}s...`);
      await sleep(wait);
      if (this.shuttingDown) break;

      try {
        await this.openConnection(1, 0);
        await this.notifyReady();
        console.log('RabbitMQ reconnected successfully');
        break;
      } catch (error) {
        console.error('RabbitMQ reconnect attempt failed:', error);
        await this.discardConnection();
      }
    }

    this.reconnecting = false;
  }

  private async notifyReady(): Promise<void> {
    for (const listener of this.readyListeners) {
      await listener();
    }
  }

  // Drops the current connection without triggering the reconnect logic
  private async discardConnection(): Promise<void> {
    const connection = this.connection;
    this.channel = null;
    this.connection = null;

    if (!connection) return;
    try {
      await connection.close();
    } catch {
      // Already closed
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

  public isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  public getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized. Call connect() first.');
    }
    return this.channel;
  }

  public async close(): Promise<void> {
    // Must be set first: it stops the automatic reconnection
    this.shuttingDown = true;

    try {
      if (this.channel) await this.channel.close();
    } catch (error) {
      console.error('Error closing RabbitMQ channel:', error);
    }

    await this.discardConnection();
    console.log('RabbitMQ connection closed gracefully');
  }
}

export const rabbitMQClient = new RabbitMQClient();
