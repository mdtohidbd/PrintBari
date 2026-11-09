import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

export class Database {
  private static instance: Database;
  private isConnected: boolean = false;

  private constructor() {
    this.registerEventListeners();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private registerEventListeners(): void {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('📦 MongoDB successfully connected to database');
    });

    mongoose.connection.on('error', (err) => {
      this.isConnected = false;
      logger.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('⚠️ MongoDB disconnected');
    });
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB is already connected');
      return;
    }

    try {
      if (env.MONGODB_URI.startsWith('mongodb+srv://')) {
        try {
          dns.setServers(['8.8.8.8', '1.1.1.1']);
        } catch (dnsErr) {
          logger.debug('Could not override DNS servers:', dnsErr);
        }
      }

      logger.info(`Attempting MongoDB connection to ${env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@')}...`);
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        autoIndex: env.NODE_ENV !== 'production',
      });
    } catch (error) {
      logger.error('Failed to establish initial MongoDB connection:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB connection closed gracefully');
    } catch (error) {
      logger.error('Error during MongoDB disconnection:', error);
    }
  }

  public getStatus(): { isConnected: boolean; readyState: number } {
    return {
      isConnected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
    };
  }
}

export const db = Database.getInstance();

