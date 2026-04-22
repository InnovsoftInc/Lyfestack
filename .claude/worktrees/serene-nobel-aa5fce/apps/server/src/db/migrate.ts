import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { config } from '../config/config';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function runMigrations(): Promise<void> {
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set to run migrations');
  }

  const pool = new Pool({ connectionString: config.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        id          SERIAL      PRIMARY KEY,
        filename    TEXT        NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await pool.query<{ filename: string }>(
      'SELECT filename FROM public._migrations ORDER BY filename'
    );
    const executed = new Set(rows.map((r) => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (executed.has(file)) {
        console.log(`[skip] ${file}`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await pool.query(sql);
      await pool.query('INSERT INTO public._migrations (filename) VALUES ($1)', [file]);
      console.log(`[done] ${file}`);
    }

    console.log('Migrations complete.');
  } finally {
    await pool.end();
  }
}

// Allow running directly: ts-node src/db/migrate.ts
if (require.main === module) {
  runMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

export { runMigrations };
