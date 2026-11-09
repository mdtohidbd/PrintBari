import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_ERROR';
  let details: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.code || 'APP_ERROR';
    details = err.details;
  } else if ((err as any).name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Database Validation Failed';
    errorCode = 'MONGOOSE_VALIDATION_ERROR';
    details = Object.values((err as any).errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
  } else if ((err as any).name === 'CastError') {
    // Mongoose bad ObjectId
    statusCode = 400;
    message = `Invalid ${(err as any).path}: ${(err as any).value}`;
    errorCode = 'INVALID_ID_FORMAT';
  } else if ((err as any).code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    const duplicatedField = Object.keys((err as any).keyValue || {})[0] || 'field';
    message = `Duplicate key error: A record with that ${duplicatedField} already exists`;
    errorCode = 'DUPLICATE_KEY_ERROR';
  }

  // Log error with context
  if (statusCode >= 500) {
    logger.error(`[${req.method} ${req.originalUrl}] - Unhandled Server Exception:`, err);
  } else {
    logger.warn(`[${req.method} ${req.originalUrl}] - Client/Operational Error [${statusCode}]: ${message}`, {
      details,
      tenantId: req.tenantId,
    });
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    errorCode,
    message,
    details,
    timestamp: new Date().toISOString(),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

