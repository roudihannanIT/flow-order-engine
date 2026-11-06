import express, { Request, Response } from 'express';
import type { Server } from 'node:http';
import dotenv from 'dotenv';
import { errorHandler } from './presentation/middlewares/errorHandler.js';
import { prisma } from './infrastructure/database/prismaClient.js';
import { redisClient } from './infrastructure/cache/redisCache.js';
import { rabbitMQClient } from './infrastructure/messaging/rabbitmqClient.js';
import { orderRoutes } from './presentation/routes/orderRoutes.js';
import { OrderConsumer } from './infrastructure/messaging/OrderConsumer.js';
import { runHealthChecks } from './shared/health/runHealthChecks.js';
import { runShutdownSteps } from './shared/shutdown/runShutdownSteps.js';
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

let server: Server | undefined;

const closeHttpServer = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!server) return resolve();
    // Stops accepting new connections and waits for in-flight requests to finish
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections();
  });

let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  // Safety net: never hang forever if something refuses to stop
  setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 15000).unref();

  // The order matters: stop taking new work first, release the dependencies last
  await runShutdownSteps([
    { name: 'HTTP server', run: closeHttpServer },
    { name: 'order consumer', run: () => OrderConsumer.stop() },
    { name: 'RabbitMQ', run: () => rabbitMQClient.close() },
    {
      name: 'Redis',
      run: async () => {
        await redisClient.quit();
      },
    },
    { name: 'Database', run: () => prisma.$disconnect() },
  ]);

  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

const startServer = async (): Promise<void> => {
  try {
    // Fail fast: do not accept traffic unless every dependency is reachable
    await withTimeout(checkDatabase(), 5000, 'Database');
    console.log('Database connected successfully');

    await withTimeout(redisClient.ping(), 5000, 'Redis');

    // The consumer is (re)started after the first connection and after every automatic reconnection
    rabbitMQClient.onReady(() => OrderConsumer.consumeOrderCreated());
    await rabbitMQClient.connect();

    server = app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the application:', error);
    process.exit(1);
  }
};

startServer();
