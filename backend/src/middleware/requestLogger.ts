import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { logger } from '../config/logger';
import { systemMonitor } from '../services/systemMonitor';

const morganMiddleware = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message: string) => {
        logger.http(message.trim());
      },
    },
  }
);

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    systemMonitor.recordMetric(req.method, req.path, res.statusCode, duration);
  });

  morganMiddleware(req, res, next);
};

