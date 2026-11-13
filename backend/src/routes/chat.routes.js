import { Router } from 'express';
import { requirePatientAuth } from '../middleware/auth.js';
import { recordAuditSafely, requestIp } from '../services/audit.service.js';
import { answerQuestion } from '../services/chat.service.js';
import { LlmError } from '../services/llm.service.js';
import { QuestionError } from '../qa/router.js';
import { MalformedAnswerError } from '../qa/answer.js';

/**
 * Records chatbot endpoints (MVP document 8.9):
 *   POST /api/me/chat                          the logged-in patient's own records
 *   POST /api/doctor/patients/:publicId/chat   mounted in doctor.routes.js behind
 *                                              doctor login, live verification and
 *                                              the patient's approved consent
 * Body: { question }. The patient is never taken from the request body.
 */

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

/**
 * @param {(req) => { patientId: string, actor: { type: 'patient' | 'doctor', id: string }, fileUrl: (id: string) => string }} context
 */
export const chatHandler = (context) => async (req, res, next) => {
	const { patientId, actor, fileUrl } = context(req);
	try {
		const result = await answerQuestion(patientId, req.body?.question, { fileUrl });
		// Audit the question's outcome, never its text (it can contain medical details).
		await recordAuditSafely({
			actorType: actor.type, actorId: actor.id, patientId, action: 'chat.question', resourceType: 'patient', resourceId: patientId,
			outcome: 'allowed', details: { status: result.status, citations: result.citations.length }, ipAddress: requestIp(req),
		});
		const { model: _model, ...data } = result;
		return res.status(200).json({ data });
	} catch (error) {
		if (error instanceof QuestionError) return fail(res, 400, 'INVALID_QUESTION', error.message);
		if (error instanceof LlmError) {
			console.error(`Chat AI error: ${error.message}`);
			return fail(
				res,
				503,
				error.configuration ? 'ASSISTANT_NOT_CONFIGURED' : 'AI_UNAVAILABLE',
				error.configuration ? 'The assistant is not set up on the server yet.' : 'The AI service is busy or unavailable. Please try again in a moment.',
			);
		}
		if (error instanceof MalformedAnswerError) return fail(res, 502, 'AI_BAD_RESPONSE', 'The AI gave an answer that could not be checked, so it was not shown. Please try again.');
		return next(error);
	}
};

const router = Router();

router.post(
	'/chat',
	requirePatientAuth,
	chatHandler((req) => ({
		patientId: req.auth.patientId,
		actor: { type: 'patient', id: req.auth.patientId },
		fileUrl: (id) => `/api/documents/${id}/file`,
	})),
);

export default router;
