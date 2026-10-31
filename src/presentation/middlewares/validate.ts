import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { AppError } from '../../shared/errors/AppError.js';

export const validateBody =
  (schema: ZodType) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new AppError('Validation failed', 400, true, details));
    }

    req.body = result.data;
    next();
  };