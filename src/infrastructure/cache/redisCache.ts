import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisClient.on('connect', () => {
  console.log('Connected to Redis successfully');
});

redisClient.on('error', (error: unknown) => {
  console.error('Redis connection error:', error);
});