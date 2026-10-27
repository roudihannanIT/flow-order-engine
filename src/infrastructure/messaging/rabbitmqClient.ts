import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

class RabbitMQClient {
  private connection: any = null;
  private channel: any = null;
  private readonly url: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://admin:password123@localhost:5672';
  }

  public async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();
      
      console.log('Connected to RabbitMQ successfully');

      this.connection.on('close', (error: unknown) => {
        console.error('RabbitMQ connection closed:', error);
        this.channel = null;
        this.connection = null;
      });
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
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