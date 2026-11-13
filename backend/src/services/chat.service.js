import { buildPatientRecords } from './records.service.js';
import { completeJson } from './llm.service.js';
import { routeQuestion } from '../qa/router.js';
import { retrieveEvidence } from '../qa/retrieve.js';
import { buildUserPrompt, parseModelAnswer, SYSTEM_PROMPT } from '../qa/answer.js';
import { validateCitations } from '../qa/citations.js';

/**
 * The records chatbot (MVP document 6.1.7, 6.2.9, 7.4): route -> retrieve ->
 * grounded LLM answer -> citation validation. Works on ONE patient's records,
 * whose id the caller has already authorised (patient token or doctor consent).
 *
 * Response:
 *   { status: 'documented' | 'documented_absent' | 'not_documented' | 'refused',
 *     answer, citations: [...], evidenceAvailable: boolean,
 *     checked: { documents, findings } }
 */

let complete = completeJson;
/** Tests replace the LLM call; the app never does. */
export const __setCompleteForTests = (fn) => {
	complete = fn ?? completeJson;
};

const notDocumented = (checked, subject = 'this') =>
	`I couldn’t find ${subject} in the ${checked.documents} document${checked.documents === 1 ? '' : 's'} and ${checked.findings} confirmed finding${checked.findings === 1 ? '' : 's'} I checked. ` +
	'That means it isn’t recorded there, not that it isn’t true. Only findings that have been reviewed and added to the medical history are searched.';

/**
 * @param {string} patientId  internal id of the authorised patient
 * @param {unknown} rawQuestion
 * @param {{ fileUrl: (documentId: string) => string }} options
 */
export const answerQuestion = async (patientId, rawQuestion, { fileUrl }) => {
	const routed = routeQuestion(rawQuestion); // throws QuestionError for invalid input
	if (routed.refused) {
		return { status: 'refused', answer: routed.message, citations: [], evidenceAvailable: false, checked: null, reason: routed.reason };
	}

	const records = await buildPatientRecords(patientId, { fileUrl });
	const { evidence, documentsChecked, findingsChecked } = retrieveEvidence(records, routed.question);
	const checked = { documents: documentsChecked, findings: findingsChecked };

	if (!documentsChecked) {
		return {
			status: 'not_documented',
			answer: 'There are no processed medical records yet. Upload documents and add their findings to the medical history, then ask again.',
			citations: [],
			evidenceAvailable: false,
			checked,
		};
	}
	// Nothing relevant was retrieved: say so without asking the model to guess.
	if (!evidence.length) {
		return { status: 'not_documented', answer: notDocumented(checked), citations: [], evidenceAvailable: false, checked };
	}

	const { text, model } = await complete({ system: SYSTEM_PROMPT, user: buildUserPrompt(routed.question, evidence) });
	const parsed = parseModelAnswer(text); // throws on malformed output
	const docs = new Map(records.documents.map((d) => [d.id, d]));
	const citations = validateCitations(parsed.citations, evidence, (id) => docs.get(id));

	// A documented answer must be backed by at least one valid citation; otherwise it is not shown.
	if (parsed.status === 'not_documented' || citations.length === 0) {
		return { status: 'not_documented', answer: notDocumented(checked, 'an answer to that'), citations: [], evidenceAvailable: false, checked, model };
	}
	return { status: parsed.status, answer: parsed.answer, citations, evidenceAvailable: true, checked, model };
};
