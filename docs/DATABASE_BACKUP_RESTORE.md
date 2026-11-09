# DocuStudio SaaS — Database Backup & Restore Guide

This guide covers operational backup and disaster recovery procedures for the MongoDB database powering DocuStudio SaaS.

---

## 1. Automated Script-Based Backups

DocuStudio includes production-grade backup and restore scripts located in `backend/src/scripts/`:

- **Backup Script:** [`backend/src/scripts/backup-db.ts`](file:///E:/Roadmap/backend/src/scripts/backup-db.ts)
- **Restore Script:** [`backend/src/scripts/restore-db.ts`](file:///E:/Roadmap/backend/src/scripts/restore-db.ts)

### How It Works:
1. Connects securely to the MongoDB cluster via `MONGODB_URI`.
2. Iterates across all multi-tenant collections (`tenants`, `users`, `jobs`, `customers`, `paymenttransactions`, `subscriptioninvoices`, `platformsettings`, `auditlogs`, `printers`, `documenttemplates`, etc.).
3. Serializes documents and compresses the payload into a gzip archive (`*.json.gz`).
4. Writes the archive to `backend/backups/docustudio_backup_<TIMESTAMP>.json.gz` with metadata validation.

---

## 2. Running a Manual Backup

Run from the project root or backend directory:

```bash
# Using npm script from backend
npx --prefix backend ts-node backend/src/scripts/backup-db.ts
```

Example Output:
```bash
[info]: Attempting MongoDB connection to mongodb+srv://...
[info]: 📦 MongoDB successfully connected to database
[info]: Database backup created: docustudio_backup_2026-11-08T07-21-29-669Z.json.gz (1973.8 KB, 732 docs)
Backup completed successfully: /opt/docustudio/backend/backups/docustudio_backup_2026-11-08T07-21-29-669Z.json.gz
```

---

## 3. Scheduling Automated Daily Backups (Cron / Linux)

To configure automated daily backups at 02:00 AM server time:

```bash
# Open server crontab
crontab -e

# Add automated daily backup entry (retains last 30 days)
0 2 * * * cd /opt/docustudio && npx --prefix backend ts-node backend/src/scripts/backup-db.ts >> /var/log/docustudio-backup.log 2>&1
0 3 * * * find /opt/docustudio/backend/backups -name "docustudio_backup_*.json.gz" -mtime +30 -exec rm {} \;
```

---

## 4. Disaster Recovery & Restoring a Backup

To restore data from an existing backup archive:

```bash
# Syntax: ts-node restore-db.ts <path-to-archive.json.gz>
npx --prefix backend ts-node backend/src/scripts/restore-db.ts /opt/docustudio/backend/backups/docustudio_backup_2026-11-08T07-21-29-669Z.json.gz
```

### Clean Restore Mode:
To wipe damaged or corrupted state before restoring cleanly:
```bash
npx --prefix backend ts-node -e "
  const { restoreDatabaseBackup } = require('./backend/src/scripts/restore-db');
  restoreDatabaseBackup('/path/to/backup.json.gz', { cleanBeforeRestore: true })
    .then(console.log);
"
```

---

## 5. Native MongoDB Tooling (`mongodump` & `mongorestore`)

For high-volume production deployments with binary BSON format:

### Dump:
```bash
mongodump --uri="mongodb+srv://<user>:<pass>@cluster0.mongodb.net/docustudio_saas" --gzip --archive=/backups/docustudio_bson_$(date +%F).gz
```

### Restore:
```bash
mongorestore --uri="mongodb+srv://<user>:<pass>@cluster0.mongodb.net/docustudio_saas" --gzip --archive=/backups/docustudio_bson_2026-11-08.gz --drop
```

---

## 6. Backup Verification Protocol

Verify backup integrity regularly:
1. Ensure the generated `.json.gz` file size is non-zero and decompression succeeds (`gzip -t <file>`).
2. Test restoring the backup into a staging database once per quarter.
3. Keep an off-site copy synced to an S3-compatible cold bucket (e.g. AWS S3 Glacier, Cloudflare R2, or DigitalOcean Spaces).

