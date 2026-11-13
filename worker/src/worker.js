/**
 * OSCO background worker (MVP document sections 5.5 and 8.3).
 *
 * A separate Node.js process that consumes two BullMQ queues in Redis:
 *   document-processing  one job per uploaded document, 2-3 at a time,
 *                        rate-limited to protect the LLM API
 *   patient-reconcile    step 8, one job per patient update, serialised per
 *                        patient by a PostgreSQL advisory lock
 *
 * Retries with backoff are set by the producer (backend queue.service.js and
 * queues.js). A failing document never stops the rest of the batch.
 */
import { Worker } from 'bullmq';
import { config } from './config.js';
import { pool } from './db.js';
import { DOCUMENT_QUEUE, RECONCILE_QUEUE, closeQueues, createRedisConnection } from './queues.js';
import { processDocument } from './jobs/processDocument.js';
import { reconcilePatient } from './jobs/reconcilePatient.js';

const log = (...args) => console.log(`[worker ${new Date().toISOString()}]`, ...args);

const documentWorker = new Worker(DOCUMENT_QUEUE, processDocument, {
	connection: createRedisConnection(),
	concurrency: config.concurrency,
	limiter: { max: config.rateLimitMax, duration: config.rateLimitWindowMs },
	// LLM calls and OCR can be slow; keep the job lock alive well past one call.
	lockDuration: Math.max(60_000, config.llm.timeoutMs + 30_000),
});

const reconcileWorker = new Worker(RECONCILE_QUEUE, reconcilePatient, {
	connection: createRedisConnection(),
	concurrency: config.reconcileConcurrency,
});

for (const [name, worker] of [['document', documentWorker], ['reconcile', reconcileWorker]]) {
	worker.on('completed', (job, result) => {
		if (name === 'document') {
			log(`document ${job.data.documentId} ready: ${result.accepted}/${result.returned} findings accepted, ${result.rejected} rejected`);
		} else {
			const pending = result.rulesNotImplemented?.length ? ` (rules not implemented: ${result.rulesNotImplemented.join(', ')})` : '';
			log(`patient ${job.data.patientId} reconciled over ${result.claims} findings${pending}`);
		}
	});
	worker.on('failed', (job, error) => {
		const attempts = job ? `attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}` : 'no job';
		log(`${name} job ${job?.id ?? '?'} failed (${attempts}): ${error.message}`);
	});
	worker.on('error', (error) => log(`${name} worker error: ${error.message}`));
}

log(
	`listening on "${DOCUMENT_QUEUE}" (concurrency ${config.concurrency}, ` +
		`limit ${config.rateLimitMax}/${config.rateLimitWindowMs}ms) and "${RECONCILE_QUEUE}"; ` +
		`extractor ${config.extractorVersion}, LLM ${config.llm.provider}:${config.llm.model}`,
);

let shuttingDown = false;
const shutdown = async (signal) => {
	if (shuttingDown) return;
	shuttingDown = true;
	log(`${signal} received, finishing active jobs...`);
	try {
		await Promise.all([documentWorker.close(), reconcileWorker.close()]);
		await closeQueues();
		await pool.end();
	} finally {
		process.exit(0);
	}
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
