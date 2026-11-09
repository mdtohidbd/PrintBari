import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { db } from './config/db';

const bootstrap = async (): Promise<void> => {
  try {
    // 1. Initialize Database Connection
    await db.connect();

    // 2. Initialize Express Application
    const app = createApp();
    const server = http.createServer(app);

    // 3. Start Listening
    server.listen(env.PORT, '0.0.0.0', () => {
      logger.info(`🚀 DocuStudio Backend API running in ${env.NODE_ENV} mode`);
      logger.info(`📡 Server address: http://${env.HOST}:${env.PORT}`);
      logger.info(`🩺 Health check: http://${env.HOST}:${env.PORT}/api/v1/health`);
    });

    // 4. Graceful Shutdown Handlers
    const handleShutdown = async (signal: string) => {
      logger.warn(`Received ${signal}. Initiating graceful shutdown...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await db.disconnect();
        logger.info('Process termination complete. Goodbye!');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: Error | any) => {
      logger.error('Unhandled Rejection at Promise:', reason);
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception thrown:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Fatal error during application startup:', error);
    process.exit(1);
  }
};

bootstrap();

