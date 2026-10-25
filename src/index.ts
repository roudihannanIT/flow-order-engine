import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { errorHandler } from './presentation/middlewares/errorHandler.js';
import { AppError } from './shared/errors/AppError.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health Check Route
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', message: 'FlowOrder Engine is running' });
});

// Test Error Route 
app.get('/error-test', (_req: Request, _res: Response, next) => {
  next(new AppError('This is a test operational error', 400));
});

// Error Handling Middleware 
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});