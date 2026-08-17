import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { AppError } from './error';

/**
 * Validates the request body, query, and params against Zod schemas.
 * Throws a formatted AppError on validation failure.
 */
export const validate = (schema: { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny }) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query) as any;
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError || (error && typeof error === 'object' && ('issues' in error || 'errors' in error))) {
        const issues = (error as any).issues || (error as any).errors || [];
        const errorMessages = Array.isArray(issues) && issues.length > 0
          ? issues.map((issue: any) => `${(issue.path || []).join('.')} is ${issue.message}`)
          : [error instanceof Error ? error.message : 'Invalid request data'];
        
        const message = `Validation failed: ${errorMessages.join(', ')}`;
        return next(new AppError(400, message, 'VALIDATION_ERROR'));
      }
      return next(error);
    }
  };
};
