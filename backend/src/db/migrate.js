import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../config/db.js';

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../migrations');

const runMigrations = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(20261113, 1)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query('COMMIT');

    const files = (await readdir(migrationsDir))
      .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
      .sort();

    for (const file of files) {
      const alreadyApplied = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file],
      );
      if (alreadyApplied.rowCount) {
        console.info(`Skipping applied migration ${file}.`);
        continue;
      }

      const sql = await readFile(resolve(migrationsDir, file), 'utf8');
      const migrationClient = await pool.connect();
      try {
        await migrationClient.query('BEGIN');
        await migrationClient.query('SELECT pg_advisory_xact_lock(20261113, 1)');
        const checkAgain = await migrationClient.query(
          'SELECT 1 FROM schema_migrations WHERE version = $1',
          [file],
        );
        if (!checkAgain.rowCount) {
          await migrationClient.query(sql);
          await migrationClient.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
          console.info(`Applied migration ${file}.`);
        }
        await migrationClient.query('COMMIT');
      } catch (error) {
        await migrationClient.query('ROLLBACK');
        throw error;
      } finally {
        migrationClient.release();
      }
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations().catch((error) => {
  console.error(`Database migration failed: ${error.message}`);
  process.exitCode = 1;
});