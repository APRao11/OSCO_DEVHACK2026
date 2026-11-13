import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

// Must match worker/src/queues.js.
export const DOCUMENT_QUEUE = 'document-processing';

let documentQueue;
const getDocumentQueue = () => {
	documentQueue ??= new Queue(DOCUMENT_QUEUE, { connection: redisConnection });
	return documentQueue;
};

/**
 * Add one processing job for an uploaded document (section 5.5).
 * The job ID is patientId + file hash (section 8.3), so uploading the same file
 * twice for the same patient does not queue it twice. BullMQ does not allow ':'
 * in custom IDs, so '_' is used as the separator.
 *
 * @param {{ documentId: string, patientId: string, fileHash: string }} document
 */
export const enqueueDocument = ({ documentId, patientId, fileHash }) =>
	getDocumentQueue().add(
		'process-document',
		{ documentId, patientId, fileHash },
		{
			jobId: `${patientId}_${fileHash}`,
			attempts: 3,
			backoff: { type: 'exponential', delay: 5_000 },
			removeOnComplete: { age: 24 * 3600, count: 1000 },
			removeOnFail: { age: 7 * 24 * 3600 },
		},
	);

export const closeQueues = async () => {
	await documentQueue?.close();
};
