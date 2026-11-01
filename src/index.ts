import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { errorHandler } from './presentation/middlewares/errorHandler.js';
import { prisma } from './infrastructure/database/prismaClient.js';
import { redisClient } from './infrastructure/cache/redisCache.js';
import { rabbitMQClient } from './infrastructure/messaging/rabbitmqClient.js';
import { orderRoutes } from './presentation/routes/orderRoutes.js';
import { OrderConsumer } from './infrastructure/messaging/OrderConsumer.js';
import { runHealthChecks } from './shared/health/runHealthChecks.js';
import { withTimeout } from './shared/utils/withTimeout.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API Routes
app.use('/api/v1/orders', orderRoutes);

const checkDatabase = async (): Promise<void> => {
  await prisma.$queryRaw`SELECT 1`;
};

// Health Check Route: reports the real state of every dependency (503 if any is down)
app.get('/health', async (_req: Request, res: Response) => {
  const report = await runHealthChecks({
    database: checkDatabase,
    redis: async () => {
      // Checking the status first avoids queueing commands while Redis is unreachable
      if (redisClient.status !== 'ready') throw new Error(`Redis status: ${redisClient.status}`);
      await redisClient.ping();
    },
    rabbitmq: async () => {
      if (!rabbitMQClient.isConnected()) throw new Error('RabbitMQ is not connected');
    },
  });

  res.status(report.status === 'ok' ? 200 : 503).json(report);
});

// Error Handling Middleware
app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    // Fail fast: do not accept traffic unless every dependency is reachable
    await withTimeout(checkDatabase(), 5000, 'Database');
    console.log('Database connected successfully');

    await withTimeout(redisClient.ping(), 5000, 'Redis');

    await rabbitMQClient.connect();

    // Activating the consumer as soon as the RabbitMQ connection is established
    await OrderConsumer.consumeOrderCreated();

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the application:', error);
    process.exit(1);
  }
};

startServer();