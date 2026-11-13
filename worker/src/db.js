import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
	connectionString: config.databaseUrl,
	max: Math.max(4, config.concurrency + config.reconcileConcurrency + 1),
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5_000,
});

pool.on('error', (error) => {
	console.error('[worker] Unexpected PostgreSQL pool error:', error.message);
});

/** Run `fn(client)` inside a transaction. */
export const withTransaction = async (fn) => {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
	}
};
