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
      ...(err.details ? { errors: err.details } : {}),
    });
  }

  // Malformed JSON body: thrown by express.json() and it is the client's fault, not ours
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON body',
    });
  }

  // (System Errors)
  console.error('UNEXPECTED ERROR:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
};