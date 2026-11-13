/**
 * Records chatbot: routing, retrieval, grounded answers and citation checks.
 * The LLM is replaced by a fake so tests are deterministic and offline.
 * Endpoint tests need a migrated throwaway database:
 *
 *   TEST_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/osco_test npm test
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
import { QuestionError, routeQuestion } from '../src/qa/router.js';
import { locate, validateCitations } from '../src/qa/citations.js';
import { retrieveEvidence } from '../src/qa/retrieve.js';

describe('question router', () => {
	test('rejects empty, too short and too long questions', () => {
		for (const q of ['', '   ', 'hi', 'x'.repeat(501), 42]) assert.throws(() => routeQuestion(q), QuestionError);
	});
	test('refuses diagnosis, treatment, dosing, interpretation and interaction questions', () => {
		for (const q of ['Do I have diabetes?', 'Should I stop taking metformin?', 'How much insulin should I take?', 'Is my HbA1c normal?', 'Can metformin interact with other drugs?']) {
			assert.equal(routeQuestion(q).refused, true, q);
		}
	});
	test('lets factual record questions through', () => {
		for (const q of ['What medicines were prescribed to me?', 'When was my last blood test?', 'What allergies are recorded?', 'Do I have any allergies recorded?']) {
			assert.equal(routeQuestion(q).refused, false, q);
		}
	});
});

describe('retrieval and citations', () => {
	const page = 'Prescription\nDate: 12 Mar 2019\nTab. Metformin 500 mg twice daily - start\nAllergies: Penicillin - rash';
	const records = {
		documents: [{ id: 'd1', kind: 'document', name: 'rx.pdf', status: 'ready', documentType: 'prescription', documentDate: '2019-03-12', pages: [{ pageNumber: 1, text: page }] }],
		findings: [
			{ id: 'f1', documentId: 'd1', category: 'medication', name: 'Metformin', nameNormalised: 'metformin', subject: 'patient', assertion: 'present', action: 'start', dose: '500 mg', frequency: 'twice daily', quote: 'Tab. Metformin 500 mg twice daily - start', page: 1, quoteStart: page.indexOf('Tab.'), quoteEnd: page.indexOf('Tab.') + 41, sourceType: 'ai_extracted' },
			{ id: 'f2', documentId: 'd1', category: 'allergy', name: 'Penicillin', nameNormalised: 'penicillin', subject: 'patient', assertion: 'present', quote: 'Allergies: Penicillin - rash', page: 1, quoteStart: page.indexOf('Allergies'), quoteEnd: page.length, sourceType: 'ai_extracted' },
		],
	};

	test('a medicine question retrieves the medicine finding first', () => {
		const { evidence } = retrieveEvidence(records, 'What medicines was I prescribed?');
		assert.equal(evidence[0].findingId, 'f1');
		assert.equal(evidence[0].id, 'E1');
	});

	test('a question about something not in the records retrieves nothing', () => {
		assert.equal(retrieveEvidence(records, 'What was my knee MRI result?').evidence.filter((e) => e.kind === 'finding').length, 0);
	});

	test('locate ignores case, spacing and quote style, and returns original offsets', () => {
		const hit = locate('Tab. Metformin  500 mg', 'metformin 500 MG');
		assert.deepEqual(hit, { start: 5, end: 22 });
		assert.equal(locate('Tab. Metformin', 'insulin'), null);
	});

	test('invented evidence ids and quotes never reach the user', () => {
		const { evidence } = retrieveEvidence(records, 'What medicines was I prescribed?');
		const docs = new Map(records.documents.map((d) => [d.id, d]));
		const out = validateCitations(
			[{ evidence: 'E99', quote: 'Metformin 2000 mg' }, { evidence: 'E1', quote: 'Metformin 2000 mg daily' }],
			evidence,
			(id) => docs.get(id),
		);
		assert.equal(out.length, 1); // E99 dropped
		assert.equal(out[0].quote, 'Tab. Metformin 500 mg twice daily - start'); // invented quote replaced by the evidence's own
		assert.equal(out[0].quoteMatchedModel, false);
		assert.equal(out[0].documentName, 'rx.pdf');
		assert.equal(out[0].page, 1);
	});

	test("a real phrase from the evidence is kept, with its position for highlighting", () => {
		const { evidence } = retrieveEvidence(records, 'What medicines was I prescribed?');
		const docs = new Map(records.documents.map((d) => [d.id, d]));
		const [c] = validateCitations([{ evidence: 'E1', quote: 'metformin 500 mg' }], evidence, (id) => docs.get(id));
		assert.equal(c.quote, 'Metformin 500 mg');
		assert.equal(page.slice(c.source.quoteStart, c.source.quoteEnd), 'Metformin 500 mg');
	});
});

const TEST_DB = process.env.TEST_DATABASE_URL;

describe('chat endpoints', { skip: !TEST_DB && 'set TEST_DATABASE_URL to run' }, () => {
	let pool;
	let server;
	let baseUrl;
	let secret;
	let chat;
	let LlmError;
	let patient;
	let other;
	let doctor;
	let llmCalls = 0;
	const page = 'Metro Diagnostics Laboratory\nReport date: 10 Jun 2024\nHbA1c 7.1 % (4.0 - 5.6)\nTab. Metformin 1000 mg once daily';

	const token = (role, id) => jwt.sign({ role }, secret, { algorithm: 'HS256', subject: id, issuer: 'osco-api', audience: `osco-${role}`, expiresIn: '1h' });
	const ask = async (path, bearer, body) => {
		const response = await fetch(`${baseUrl}${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
			body: JSON.stringify(body),
		});
		return { status: response.status, body: await response.json().catch(() => null) };
	};
	const fakeLlm = (reply) => chat.__setCompleteForTests(async () => {
		llmCalls += 1;
		if (reply instanceof Error) throw reply;
		return { text: typeof reply === 'string' ? reply : JSON.stringify(reply), model: 'fake' };
	});
	const createPatient = async () => {
		const { rows } = await pool.query(`INSERT INTO patients (full_name, email, password_hash) VALUES ('Chat Patient', $1, 'x') RETURNING id, public_id`, [`chat-${randomUUID()}@test.local`]);
		return { id: rows[0].id, publicId: rows[0].public_id, token: token('patient', rows[0].id) };
	};

	before(async () => {
		process.env.NODE_ENV = 'test';
		process.env.DATABASE_URL = TEST_DB;
		process.env.JWT_SECRET ||= 'integration-test-only-secret-0123456789abcdef';
		process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/2';
		secret = process.env.JWT_SECRET;
		const [{ createApp }, db] = await Promise.all([import('../src/server.js'), import('../src/config/db.js')]);
		chat = await import('../src/services/chat.service.js');
		({ LlmError } = await import('../src/services/llm.service.js'));
		pool = db.pool;
		server = createApp().listen(0);
		await new Promise((resolve) => server.once('listening', resolve));
		baseUrl = `http://127.0.0.1:${server.address().port}`;

		patient = await createPatient();
		other = await createPatient();
		const hash = createHash('sha256').update(randomUUID()).digest('hex');
		const { rows } = await pool.query(
			`INSERT INTO documents (patient_id, original_filename, storage_key, mime_type, byte_size, original_sha256, status, document_type, document_date)
			 VALUES ($1, 'lab-2024.pdf', $2, 'application/pdf', 100, $3, 'ready', 'lab_report', '2024-06-10') RETURNING id`,
			[patient.id, `${patient.id}/${hash}.pdf`, hash],
		);
		const docId = rows[0].id;
		await pool.query(`INSERT INTO document_pages (document_id, page_number, text_source, page_text) VALUES ($1, 1, 'text_layer', $2)`, [docId, page]);
		const claim = (category, name, value, unit, dose, quote) =>
			pool.query(
				`INSERT INTO claims (patient_id, document_id, category, name, name_normalised, subject, assertion, value, unit, dose, quote, page, quote_start, quote_end,
				                     match_type, source_type, extractor_version, fingerprint, review_status)
				 VALUES ($1, $2, $3, $4, lower($4), 'patient', 'present', $5, $6, $7, $8, 1, $9, $10, 'exact', 'ai_extracted', 'test', $11, 'confirmed')`,
				[patient.id, docId, category, name, value, unit, dose, quote, page.indexOf(quote), page.indexOf(quote) + quote.length, createHash('sha256').update(randomUUID()).digest('hex')],
			);
		await claim('investigation', 'HbA1c', '7.1', '%', null, 'HbA1c 7.1 % (4.0 - 5.6)');
		await claim('medication', 'Metformin', null, null, '1000 mg', 'Tab. Metformin 1000 mg once daily');
		const d = await pool.query(
			`INSERT INTO doctors (full_name, email, password_hash, license_number, verification_status) VALUES ('Dr Chat', $1, 'x', $2, 'verified') RETURNING id`,
			[`dr-${randomUUID()}@test.local`, `LIC-${randomUUID()}`],
		);
		doctor = { id: d.rows[0].id, token: token('doctor', d.rows[0].id) };
	});

	after(async () => {
		chat?.__setCompleteForTests(null);
		await new Promise((resolve) => server?.close(resolve));
		await (await import('../src/services/queue.service.js')).closeQueues().catch(() => {});
		await pool?.end();
	});

	test('a patient gets a grounded answer with a validated citation', async () => {
		fakeLlm({ status: 'documented', answer: 'Your HbA1c was 7.1 % on 10 Jun 2024.', citations: [{ evidence: 'E1', quote: 'HbA1c 7.1 %' }] });
		const res = await ask('/api/me/chat', patient.token, { question: 'What was my HbA1c result?' });
		assert.equal(res.status, 200, JSON.stringify(res.body));
		const { data } = res.body;
		assert.equal(data.status, 'documented');
		assert.equal(data.evidenceAvailable, true);
		assert.equal(data.citations[0].documentName, 'lab-2024.pdf');
		assert.equal(data.citations[0].page, 1);
		assert.equal(data.citations[0].quote, 'HbA1c 7.1 %');
		assert.match(data.citations[0].source.document.fileUrl, /^\/api\/documents\/.+\/file$/);
		const audit = await pool.query(`SELECT details FROM audit_logs WHERE action = 'chat.question' AND patient_id = $1 ORDER BY created_at DESC LIMIT 1`, [patient.id]);
		assert.equal(audit.rows[0].details.status, 'documented');
		assert.equal(audit.rows[0].details.question, undefined); // the question text is never logged
	});

	test('an answer whose citations are all invented is not shown', async () => {
		fakeLlm({ status: 'documented', answer: 'You take insulin 20 units.', citations: [{ evidence: 'E42', quote: 'insulin 20 units' }] });
		const res = await ask('/api/me/chat', patient.token, { question: 'What medicines am I prescribed?' });
		assert.equal(res.body.data.status, 'not_documented');
		assert.doesNotMatch(res.body.data.answer, /insulin/);
		assert.equal(res.body.data.citations.length, 0);
	});

	test('nothing relevant in the records: "not documented" without calling the AI', async () => {
		const before = llmCalls;
		fakeLlm({ status: 'documented', answer: 'x', citations: [] });
		const res = await ask('/api/me/chat', patient.token, { question: 'What did my knee MRI show?' });
		assert.equal(res.body.data.status, 'not_documented');
		assert.match(res.body.data.answer, /1 document/);
		assert.equal(llmCalls, before);
	});

	test('refused questions never reach the AI', async () => {
		const before = llmCalls;
		const res = await ask('/api/me/chat', patient.token, { question: 'Should I stop taking metformin?' });
		assert.equal(res.body.data.status, 'refused');
		assert.equal(llmCalls, before);
	});

	test('invalid input, malformed AI output and AI outages give clear errors', async () => {
		assert.equal((await ask('/api/me/chat', patient.token, { question: '  ' })).status, 400);
		assert.equal((await ask('/api/me/chat', patient.token, {})).body.error.code, 'INVALID_QUESTION');
		fakeLlm('this is not json');
		assert.equal((await ask('/api/me/chat', patient.token, { question: 'What was my HbA1c?' })).body.error.code, 'AI_BAD_RESPONSE');
		fakeLlm(new LlmError('down'));
		const down = await ask('/api/me/chat', patient.token, { question: 'What was my HbA1c?' });
		assert.equal(down.status, 503);
		assert.equal(down.body.error.code, 'AI_UNAVAILABLE');
	});

	test('a patient only ever searches their own records', async () => {
		fakeLlm({ status: 'documented', answer: 'x', citations: [{ evidence: 'E1', quote: 'HbA1c' }] });
		const res = await ask('/api/me/chat', other.token, { question: 'What was my HbA1c result?', patientId: patient.id });
		assert.equal(res.body.data.status, 'not_documented'); // the body's patientId is ignored; this patient has no records
		assert.equal((await ask('/api/me/chat', null, { question: 'What was my HbA1c?' })).status, 401);
	});

	test('doctors need the patient’s consent, and then search only that patient', async () => {
		fakeLlm({ status: 'documented', answer: 'Metformin 1000 mg once daily is documented.', citations: [{ evidence: 'E1', quote: 'Metformin 1000 mg once daily' }] });
		const path = `/api/doctor/patients/${patient.publicId}/chat`;
		assert.equal((await ask(path, doctor.token, { question: 'What medicines are recorded?' })).status, 403);

		const req = await fetch(`${baseUrl}/api/doctor/access-requests`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${doctor.token}` },
			body: JSON.stringify({ patientId: patient.publicId, purpose: 'Consultation', access: 'read' }),
		}).then((r) => r.json());
		await fetch(`${baseUrl}/api/access/${req.data.request.id}/approve`, { method: 'POST', headers: { authorization: `Bearer ${patient.token}` } });

		const res = await ask(path, doctor.token, { question: 'What medicines are recorded?' });
		assert.equal(res.status, 200, JSON.stringify(res.body));
		assert.equal(res.body.data.status, 'documented');
		assert.match(res.body.data.citations[0].source.document.fileUrl, new RegExp(`^/api/doctor/patients/${patient.publicId}/documents/`));
		// Consent is per patient: the same doctor cannot ask about another patient.
		assert.equal((await ask(`/api/doctor/patients/${other.publicId}/chat`, doctor.token, { question: 'What medicines are recorded?' })).status, 403);
		// Patient tokens cannot use the doctor route.
		assert.equal((await ask(path, patient.token, { question: 'What medicines are recorded?' })).status, 401);
	});
});
