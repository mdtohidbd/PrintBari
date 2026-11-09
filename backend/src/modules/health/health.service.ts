import os from 'os';
import { db } from '../../config/db';
import { env } from '../../config/env';

export class HealthService {
  public getHealthStatus() {
    const memoryUsage = process.memoryUsage();
    const dbStatus = db.getStatus();

    return {
      status: dbStatus.isConnected ? 'UP' : 'DEGRADED',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        type: 'MongoDB',
        connected: dbStatus.isConnected,
        readyState: dbStatus.readyState,
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
        totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
        processHeapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
    };
  }
}

export const healthService = new HealthService();

