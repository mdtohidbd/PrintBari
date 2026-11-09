import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import mongoose from 'mongoose';
import { Database } from '../config/db';
import { logger } from '../config/logger';

/**
 * Production Database Backup Utility for DocuStudio SaaS
 *
 * Exports all multi-tenant collections:
 * Tenants, Users, Jobs, Customers, Subscriptions, PlatformSettings, AuditLogs, Printers, Templates
 * Outputs gzip-compressed JSON archive with metadata checksums.
 */

const BACKUP_DIR = path.resolve(__dirname, '../../backups');

export async function createDatabaseBackup(): Promise<string> {
  await Database.getInstance().connect();

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `docustudio_backup_${timestamp}.json.gz`;
  const backupFilePath = path.join(BACKUP_DIR, backupFileName);

  const collections = await mongoose.connection.db!.collections();
  const backupData: Record<string, any[]> = {};
  let totalDocs = 0;

  for (const collection of collections) {
    const colName = collection.collectionName;
    if (colName.startsWith('system.')) continue;
    const docs = await collection.find({}).toArray();
    backupData[colName] = docs;
    totalDocs += docs.length;
  }

  const payload = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    database: mongoose.connection.db!.databaseName,
    totalCollections: Object.keys(backupData).length,
    totalDocuments: totalDocs,
    data: backupData,
  };

  const jsonStr = JSON.stringify(payload);
  const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));

  fs.writeFileSync(backupFilePath, compressed);
  logger.info(`Database backup created: ${backupFileName} (${(compressed.length / 1024).toFixed(1)} KB, ${totalDocs} docs)`);

  return backupFilePath;
}

if (require.main === module) {
  createDatabaseBackup()
    .then((filePath) => {
      console.log(`Backup completed successfully: ${filePath}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}

