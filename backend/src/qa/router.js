/**
 * Question router (MVP document 7.4): every question is checked before
 * anything is retrieved. Factual questions about the records continue;
 * diagnosis, treatment, dosing and result-interpretation questions are refused
 * without calling the LLM, because the assistant only reports what records say.
 */

export const MAX_QUESTION_LENGTH = 500;

const OUT_OF_SCOPE = [
	{ reason: 'diagnosis', pattern: /\b(do i have|have i got|am i (sick|ill|diabetic)|what('?s| is) wrong with me|diagnos(e|is) me|could (it|this) be)\b/i },
	{ reason: 'treatment', pattern: /\b(should i|can i|is it (safe|ok|okay) (to|for me)|must i)\b.*\b(take|stop|start|increase|decrease|reduce|skip|continue|change|switch|use|eat|drink|exercise)\b/i },
	{ reason: 'dosing', pattern: /\b(how (much|many)|what dose|which dose|what dosage)\b.*\b(should|can|must|do i need)\b/i },
	{ reason: 'interpretation', pattern: /\b(is|are|was|were)\b.*\b(normal|abnormal|high|low|good|bad|dangerous|serious|worrying|concerning|ok|okay|fine)\b\??$/i },
	{ reason: 'interaction', pattern: /\b(interact|interaction|combine|together with|mix)\b.*\b(drug|medicine|medication|tablet|pill)s?\b/i },
];

const REFUSALS = {
	diagnosis: 'I can’t diagnose or say whether you have a condition. I can only tell you what your medical records say. Try asking, for example, “What diagnoses are recorded?”',
	treatment: 'I can’t advise on starting, stopping or changing treatment. Please ask your doctor. I can tell you what your records say about a medicine, for example when it was started or stopped.',
	dosing: 'I can’t advise on doses. Please ask your doctor or pharmacist. I can tell you the doses written in your records.',
	interpretation: 'I can’t interpret whether a result is normal or concerning. I can show the value, unit and the laboratory’s own reference range as written in your records.',
	interaction: 'I can’t check medicine interactions. Please ask your doctor or pharmacist. I can list the medicines recorded in your documents.',
};

// "Do I have any allergies recorded?" asks what the records say, not for a diagnosis.
const ASKS_ABOUT_RECORDS = /\b(record(s|ed)?|document(s|ed)?|listed|mentioned|written|noted|on file|report(s|ed)?|history|allerg(y|ies|ic)|medicines?|medications?|prescri(bed|ptions?)|tests?|results?|visits?|appointments?)\b/i;

export class QuestionError extends Error {}

/** Validate and classify. @returns {{ question: string, refused: false } | { question: string, refused: true, reason: string, message: string }} */
export const routeQuestion = (raw) => {
	if (typeof raw !== 'string') throw new QuestionError('Send your question as text.');
	const question = raw.replace(/\s+/g, ' ').trim();
	if (!question) throw new QuestionError('Type a question first.');
	if (question.length < 3) throw new QuestionError('That question is too short. Ask about your medicines, tests, diagnoses or visits.');
	if (question.length > MAX_QUESTION_LENGTH) throw new QuestionError(`Questions can be up to ${MAX_QUESTION_LENGTH} characters.`);
	for (const { reason, pattern } of OUT_OF_SCOPE) {
		if (reason === 'diagnosis' && ASKS_ABOUT_RECORDS.test(question)) continue;
		if (pattern.test(question)) return { question, refused: true, reason, message: REFUSALS[reason] };
	}
	return { question, refused: false };
};
