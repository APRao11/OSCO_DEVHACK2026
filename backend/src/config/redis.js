// Imported for its side effect: loads backend/.env before REDIS_URL is read.
import './env.js';

/** BullMQ connection options parsed from REDIS_URL (default redis://127.0.0.1:6379). */
const parseRedisUrl = (value) => {
	const url = new URL(value);
	if (!['redis:', 'rediss:'].includes(url.protocol)) {
		throw new Error('REDIS_URL must use the redis:// or rediss:// scheme.');
	}
	return {
		host: url.hostname,
		port: Number(url.port || 6379),
		username: url.username ? decodeURIComponent(url.username) : undefined,
		password: url.password ? decodeURIComponent(url.password) : undefined,
		db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
		tls: url.protocol === 'rediss:' ? {} : undefined,
	};
};

export const redisConnection = parseRedisUrl(process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379');
