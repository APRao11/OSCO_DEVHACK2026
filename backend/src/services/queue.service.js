import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

// Must match worker/src/queues.js.
export const DOCUMENT_QUEUE = 'document-processing';

// An upload must never hang because Redis is down; the document stays stored and can be re-queued.
const QUEUE_TIMEOUT_MS = 3_000;

let documentQueue;
let lastQueueError = 0;
const getDocumentQueue = () => {
	if (!documentQueue) {
		documentQueue = new Queue(DOCUMENT_QUEUE, { connection: { ...redisConnection, enableOfflineQueue: false } });
		documentQueue.on('error', (error) => {
			// Log at most once a minute instead of on every reconnect attempt.
			if (Date.now() - lastQueueError > 60_000) {
				console.error(`Document queue unavailable (is Redis running?): ${error.message}`);
				lastQueueError = Date.now();
			}
		});
	}
	return documentQueue;
};

const withTimeout = (promise) =>
	Promise.race([
		promise,
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error('The processing queue (Redis) is not reachable.')), QUEUE_TIMEOUT_MS),
		),
	]);

/**
 * BullMQ does not allow ':' in custom IDs, so the spec's patientId:fileHash
 * becomes patientId_fileHash (section 8.3).
 */
const jobIdFor = ({ patientId, fileHash }) => `${patientId}_${fileHash}`;

const JOB_OPTIONS = {
	attempts: 3,
	backoff: { type: 'exponential', delay: 5_000 },
	removeOnComplete: { age: 24 * 3600, count: 1000 },
	removeOnFail: { age: 7 * 24 * 3600 },
};

/**
 * Queue one processing job for an uploaded document (section 5.5).
 * If a job for the same file already exists it is reused: a failed job is
 * retried, a finished one is replaced, a waiting or running one is left alone.
 *
 * @param {{ documentId: string, patientId: string, fileHash: string }} document
 * @returns {Promise<{ queued: true, state: string }>}  rejects if the queue is unreachable
 */
export const enqueueDocument = (document) =>
	withTimeout(
		(async () => {
			const queue = getDocumentQueue();
			const jobId = jobIdFor(document);
			const existing = await queue.getJob(jobId);
			if (existing) {
				const state = await existing.getState();
				if (state === 'failed') {
					await existing.retry();
					return { queued: true, state: 'retried' };
				}
				if (state === 'completed') {
					await existing.remove();
				} else {
					return { queued: true, state };
				}
			}
			await queue.add('process-document', document, { ...JOB_OPTIONS, jobId });
			return { queued: true, state: 'waiting' };
		})(),
	);

// Must match worker/src/queues.js.
export const RECONCILE_QUEUE = 'patient-reconcile';
let reconcileQueue;

/**
 * Rebuild one patient's medication histories (step 8) after the patient
 * confirms or edits findings. The worker serialises these per patient.
 * Best effort: if Redis is down the history updates on the next reconcile.
 */
export const enqueueReconcile = async (patientId, reason) => {
	try {
		reconcileQueue ??= new Queue(RECONCILE_QUEUE, { connection: { ...redisConnection, enableOfflineQueue: false } });
		reconcileQueue.on('error', () => {});
		await withTimeout(
			reconcileQueue.add(
				'reconcile-patient',
				{ patientId, triggeredBy: reason },
				{ jobId: `reconcile_${patientId}_${Date.now()}`, attempts: 3, backoff: { type: 'exponential', delay: 5_000 }, removeOnComplete: { age: 3600 }, removeOnFail: { age: 24 * 3600 } },
			),
		);
		return true;
	} catch (error) {
		console.error(`Could not queue reconciliation for ${patientId}: ${error.message}`);
		return false;
	}
};

export const closeQueues = async () => {
	await documentQueue?.close();
	await reconcileQueue?.close();
};
