import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import mongoose from 'mongoose';
import { Database } from '../config/db';
import { logger } from '../config/logger';

/**
 * Production Database Restore Utility for DocuStudio SaaS
 *
 * Restores all collections from gzip-compressed JSON archive.
 * Supports clean restore or differential merge mode.
 */

export async function restoreDatabaseBackup(
  backupFilePath: string,
  options: { cleanBeforeRestore?: boolean } = {}
): Promise<{ restoredCollections: number; restoredDocuments: number }> {
  await Database.getInstance().connect();

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at: ${backupFilePath}`);
  }

  const compressed = fs.readFileSync(backupFilePath);
  const jsonStr = zlib.gunzipSync(compressed).toString('utf-8');
  const payload = JSON.parse(jsonStr);

  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('Invalid backup archive structure');
  }

  const db = mongoose.connection.db!;
  let restoredCollections = 0;
  let restoredDocuments = 0;

  for (const [collectionName, documents] of Object.entries(payload.data)) {
    if (!Array.isArray(documents) || documents.length === 0) continue;

    const col = db.collection(collectionName);

    if (options.cleanBeforeRestore) {
      await col.deleteMany({});
    }

    // Insert restored documents using bulk insert with ordered=false to handle duplicates
    try {
      const result = await col.insertMany(documents as any[], { ordered: false });
      restoredDocuments += result.insertedCount;
    } catch (err: any) {
      // If duplicates occur, count inserted
      if (err.insertedCount) {
        restoredDocuments += err.insertedCount;
      }
    }

    restoredCollections++;
  }

  logger.info(
    `Database restore completed from ${path.basename(backupFilePath)}: ${restoredCollections} collections, ${restoredDocuments} docs restored`
  );

  return { restoredCollections, restoredDocuments };
}

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: ts-node restore-db.ts <path-to-backup.json.gz>');
    process.exit(1);
  }

  restoreDatabaseBackup(filePath)
    .then((res) => {
      console.log(`Restore completed successfully:`, res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Restore failed:', err);
      process.exit(1);
    });
}

