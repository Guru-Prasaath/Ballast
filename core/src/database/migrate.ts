import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const MIGRATIONS_FOLDER = join(__dirname, 'migrations');

/**
 * Applies all pending Drizzle migrations, then exits. Run via `npm run
 * db:migrate` (with DATABASE_URL set) or programmatically from tests. Safe to
 * run repeatedly — already-applied migrations are skipped.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  // Load .env for local runs; in CI the environment is already populated.
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  await runMigrations(databaseUrl);
  // eslint-disable-next-line no-console
  console.log('Migrations applied.');
}

// Run only when invoked directly (not when imported by tests).
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
