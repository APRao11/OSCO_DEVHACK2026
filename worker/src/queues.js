import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config.js';

// Must match the names the backend producer uses (backend/src/services/queue.service.js).
export const DOCUMENT_QUEUE = 'document-processing';
export const RECONCILE_QUEUE = 'patient-reconcile';

/** BullMQ workers need maxRetriesPerRequest: null on their blocking connection. */
export const createRedisConnection = () => new IORedis(config.redisUrl, { maxRetriesPerRequest: null });

let reconcileQueue;
const getReconcileQueue = () => {
	reconcileQueue ??= new Queue(RECONCILE_QUEUE, { connection: createRedisConnection() });
	return reconcileQueue;
};

/**
 * Step 8 runs as its own job so two documents finishing at once cannot both
 * rebuild the same patient's timeline (section 8.3). The job also takes a
 * per-patient advisory lock. BullMQ custom IDs may not contain ':'.
 */
export const enqueueReconcile = (patientId, triggeredBy) =>
	getReconcileQueue().add(
		'reconcile-patient',
		{ patientId, triggeredBy },
		{
			jobId: `reconcile_${patientId}_${triggeredBy}`,
			attempts: config.jobAttempts,
			backoff: { type: 'exponential', delay: config.backoffMs },
			removeOnComplete: { age: 24 * 3600, count: 1000 },
			removeOnFail: { age: 7 * 24 * 3600 },
		},
	);

export const closeQueues = async () => {
	if (reconcileQueue) {
		const connection = reconcileQueue.opts.connection;
		await reconcileQueue.close();
		await connection.quit?.();
	}
};
