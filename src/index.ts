import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { errorHandler } from './presentation/middlewares/errorHandler.js';
import { AppError } from './shared/errors/AppError.js';
import { prisma } from './infrastructure/database/prismaClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health Check & DB Connection Check Route
app.get('/health', async (_req: Request, res: Response, next) => {
  try {
    
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({ 
      status: 'OK', 
      message: 'FlowOrder Engine is running',
      database: 'Connected successfully' 
    });
  } catch (error) {
    next(new AppError('Database connection failed', 500));
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
  console.log(`Server is running on http://localhost:${PORT}`);
});