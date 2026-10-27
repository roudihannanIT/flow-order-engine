import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { errorHandler } from './presentation/middlewares/errorHandler.js';
import { AppError } from './shared/errors/AppError.js';
import { prisma } from './infrastructure/database/prismaClient.js';
import { redisClient } from './infrastructure/cache/redisCache.js';
import { rabbitMQClient } from './infrastructure/messaging/rabbitmqClient.js';
import { orderRoutes } from './presentation/routes/orderRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API Routes
app.use('/api/v1/orders', orderRoutes);

// Health Check Route
app.get('/health', async (_req: Request, res: Response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const redisStatus = redisClient.status;

    res.status(200).json({ 
      status: 'OK', 
      message: 'FlowOrder Engine is running',
      database: 'Connected successfully',
      redis: redisStatus === 'ready' ? 'Connected successfully' : `Status: ${redisStatus}`,
      rabbitmq: 'Connected successfully'
    });
  } catch (error) {
    next(new AppError('Infrastructure connection failed', 500));
  }
});

// Error Handling Middleware
app.use(errorHandler);

app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
  }

  try {
    await rabbitMQClient.connect();
  } catch (error) {
    console.error('Failed to initialize RabbitMQ during startup:', error);
  }

  console.log(`Server is running on http://localhost:${PORT}`);
});