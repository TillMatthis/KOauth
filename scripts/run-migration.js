/**
 * Manual migration runner
 * Used when Prisma CLI can't download binaries
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dev.db');
const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20251121_add_email_password_auth', 'migration.sql');

// Create database connection
const db = new Database(dbPath);

// Read migration file
const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

// Split by statements and execute
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Running ${statements.length} migration statements...`);

try {
  db.exec('BEGIN TRANSACTION');

  for (const statement of statements) {
    console.log(`Executing: ${statement.substring(0, 50)}...`);
    db.exec(statement);
  }

  // Create _prisma_migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Record this migration
  const migrationId = Date.now().toString();
  const insertStmt = db.prepare(`
    INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
    VALUES (?, ?, ?, datetime('now'), ?)
  `);

  insertStmt.run(migrationId, 'manual', '20251121_add_email_password_auth', statements.length);

  db.exec('COMMIT');

  console.log('✅ Migration completed successfully!');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
