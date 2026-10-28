import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

class RabbitMQClient {
  private connection: any = null;
  private channel: any = null;
  private readonly url: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  }

  public async connect(retries = 5, delay = 3000): Promise<void> {
    for (let i = 1; i <= retries; i++) {
      try {
        this.connection = await amqp.connect(this.url);
        this.channel = await this.connection.createChannel();
        
        console.log('Connected to RabbitMQ successfully');

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