import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // (System Errors)
  console.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
};