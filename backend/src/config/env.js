import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: resolve(backendRoot, '.env') });

const parsePort = (value) => {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error('PORT must be an integer between 1 and 65535.');
	}
	return port;
};

const parseDatabaseUrl = (value) => {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
	}
	if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
		throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme.');
	}
	return value;
};

export const loadEnv = (source = process.env) => {
	const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !source[key]?.trim());
	if (missing.length) {
		throw new Error(`Missing required environment variable(s): ${missing.join(', ')}.`);
	}

	const jwtSecret = source.JWT_SECRET.trim();
	if (jwtSecret.length < 32 || /replace|change[-_ ]?me|your[-_ ]/i.test(jwtSecret)) {
		throw new Error('JWT_SECRET must be replaced with at least 32 characters of random secret material.');
	}

	const nodeEnv = source.NODE_ENV || 'development';
	if (!['development', 'test', 'production'].includes(nodeEnv)) {
		throw new Error('NODE_ENV must be development, test, or production.');
	}

	const corsOrigins = (source.CORS_ORIGINS || 'http://localhost:5173')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	return Object.freeze({
		nodeEnv,
		port: parsePort(source.PORT || '3000'),
		databaseUrl: parseDatabaseUrl(source.DATABASE_URL.trim()),
		jwtSecret,
		corsOrigins,
		documentStorageDir: resolve(backendRoot, source.DOCUMENT_STORAGE_DIR || 'storage/originals'),
	});
};

export const env = loadEnv();
