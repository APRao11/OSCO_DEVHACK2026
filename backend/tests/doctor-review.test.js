/**
 * Doctor review tabs: flags (Alert and Reviews), verification, and clinical
 * records (Add Changes). Needs a migrated throwaway database:
 *
 *   TEST_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/osco_test npm test
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';

const TEST_DB = process.env.TEST_DATABASE_URL;

describe('doctor review: flags, verification, clinical records', { skip: !TEST_DB && 'set TEST_DATABASE_URL to run' }, () => {
	let pool;
	let server;
	let baseUrl;
	let secret;
	let patient;
	let doctor;
	let penicillin;
	let nkda;
	let flagId;

	const token = (role, id) =>
		jwt.sign({ role }, secret, { algorithm: 'HS256', subject: id, issuer: 'osco-api', audience: `osco-${role}`, expiresIn: '1h' });
	const call = async (method, path, bearer, body) => {
		const response = await fetch(`${baseUrl}${path}`, {
			method,
			headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
		return { status: response.status, body: await response.json().catch(() => null) };
	};
	const doc = async (date) => {
		const hash = createHash('sha256').update(randomUUID()).digest('hex');
		const { rows } = await pool.query(
			`INSERT INTO documents (patient_id, original_filename, storage_key, mime_type, byte_size, original_sha256, status, document_type, document_date)
			 VALUES ($1, $2, $3, 'application/pdf', 100, $4, 'ready', 'clinical_note', $5) RETURNING id`,
			[patient.id, `note-${date}.pdf`, `${patient.id}/${hash}.pdf`, hash, date],
		);
		return rows[0].id;
	};
	const claim = async (documentId, name, assertion, quote) => {
		const { rows } = await pool.query(
			`INSERT INTO claims (patient_id, document_id, category, name, name_normalised, subject, assertion, quote, page, quote_start, quote_end,
			                     match_type, source_type, extractor_version, fingerprint, review_status)
			 VALUES ($1, $2, 'allergy', $3, lower($3), 'patient', $4, $5, 1, 0, $6, 'exact', 'ai_extracted', 'test', $7, 'confirmed') RETURNING id`,
			[patient.id, documentId, name, assertion, quote, quote.length, createHash('sha256').update(randomUUID()).digest('hex')],
		);
		return rows[0].id;
	};
	const grant = async (level) => {
		await pool.query('UPDATE doctor_access_sessions SET revoked_at = now() WHERE patient_id = $1 AND revoked_at IS NULL', [patient.id]);
		const req = await call('POST', '/api/doctor/access-requests', doctor.token, { patientId: patient.publicId, purpose: 'Review', access: level });
		const ok = await call('POST', `/api/access/${req.body.data.request.id}/approve`, patient.token);
		assert.equal(ok.status, 200);
	};
	const base = () => `/api/doctor/patients/${patient.publicId}`;

	before(async () => {
		process.env.NODE_ENV = 'test';
		process.env.DATABASE_URL = TEST_DB;
		process.env.JWT_SECRET ||= 'integration-test-only-secret-0123456789abcdef';
		process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/2';
		secret = process.env.JWT_SECRET;
		const [{ createApp }, db] = await Promise.all([import('../src/server.js'), import('../src/config/db.js')]);
		pool = db.pool;
		server = createApp().listen(0);
		await new Promise((resolve) => server.once('listening', resolve));
		baseUrl = `http://127.0.0.1:${server.address().port}`;

		const p = await pool.query(`INSERT INTO patients (full_name, email, password_hash) VALUES ('Review Patient', $1, 'x') RETURNING id, public_id`, [`rv-${randomUUID()}@test.local`]);
		patient = { id: p.rows[0].id, publicId: p.rows[0].public_id, token: token('patient', p.rows[0].id) };
		const d = await pool.query(
			`INSERT INTO doctors (full_name, email, password_hash, license_number, verification_status) VALUES ('Dr Review', $1, 'x', $2, 'verified') RETURNING id`,
			[`dr-${randomUUID()}@test.local`, `LIC-${randomUUID()}`],
		);
		doctor = { id: d.rows[0].id, token: token('doctor', d.rows[0].id) };

		penicillin = await claim(await doc('2018-08-14'), 'Penicillin', 'present', 'Allergy: Penicillin (rash)');
		nkda = await claim(await doc('2021-02-03'), 'any drug, general statement', 'absent', 'No known drug allergies');
		// What the worker's reconcile job writes for this pair (contradictions.js).
		const f = await pool.query(
			`INSERT INTO record_flags (patient_id, type, message, finding_ids, fingerprint) VALUES ($1, 'contradiction', 'An allergy to Penicillin is recorded, but another record says there are no known drug allergies. Records disagree, needs review.', $2::uuid[], $3) RETURNING id`,
			[patient.id, [penicillin, nkda], createHash('sha256').update(randomUUID()).digest('hex')],
		);
		flagId = f.rows[0].id;
	});

	after(async () => {
		await new Promise((resolve) => server?.close(resolve));
		await (await import('../src/services/queue.service.js')).closeQueues().catch(() => {});
		await pool?.end();
	});

	test('the doctor sees open flags with the findings on both sides', async () => {
		await grant('read');
		const res = await call('GET', `${base()}/records`, doctor.token);
		assert.equal(res.status, 200);
		const flag = res.body.data.flags.find((f) => f.id === flagId);
		assert.equal(flag.status, 'open');
		assert.deepEqual(flag.findingIds.sort(), [penicillin, nkda].sort());
		const ids = new Set(res.body.data.findings.map((f) => f.id));
		assert.ok(ids.has(penicillin) && ids.has(nkda));
	});

	test('view-only consent cannot resolve, verify or add records', async () => {
		assert.equal((await call('POST', `${base()}/flags/${flagId}/resolve`, doctor.token, { note: 'x' })).status, 403);
		assert.equal((await call('POST', `${base()}/findings/${penicillin}/verify`, doctor.token)).status, 403);
		assert.equal((await call('POST', `${base()}/clinical-records`, doctor.token, { consultationDate: '2024-01-15', observations: 'x' })).status, 403);
	});

	test('verify marks a finding Doctor-verified without changing it, and is audited', async () => {
		await grant('edit');
		const res = await call('POST', `${base()}/findings/${penicillin}/verify`, doctor.token);
		assert.equal(res.status, 200);
		assert.equal(res.body.data.finding.verificationStatus, 'doctor_verified');
		assert.equal(res.body.data.finding.name, 'Penicillin');
		assert.equal(res.body.data.finding.reviewedBy.type, 'doctor');
		const audit = await pool.query(`SELECT actor_id FROM audit_logs WHERE action = 'finding.verify' AND resource_id = $1`, [penicillin]);
		assert.equal(audit.rows[0].actor_id, doctor.id);
	});

	test('resolving a flag needs a note, records who, and is not repeatable', async () => {
		assert.equal((await call('POST', `${base()}/flags/${flagId}/resolve`, doctor.token, { note: '  ' })).status, 400);
		const res = await call('POST', `${base()}/flags/${flagId}/resolve`, doctor.token, { note: 'Confirmed with patient: penicillin rash in 2018.' });
		assert.equal(res.status, 200);
		const records = await call('GET', `${base()}/records`, doctor.token);
		const flag = records.body.data.flags.find((f) => f.id === flagId);
		assert.equal(flag.status, 'resolved');
		assert.equal(flag.resolution.by, 'Dr Review');
		assert.match(flag.resolution.note, /penicillin rash/);
		assert.equal((await call('POST', `${base()}/flags/${flagId}/resolve`, doctor.token, { note: 'again' })).status, 404);
	});

	test('a clinical record is validated', async () => {
		const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
		for (const body of [
			{ consultationDate: tomorrow, observations: 'x' },
			{ consultationDate: '2024-13-40', observations: 'x' },
			{ consultationDate: '2024-01-15' },
			{ consultationDate: '2024-01-15', diagnoses: [{ name: '' }] },
			{ consultationDate: '2024-01-15', diagnoses: [{ name: 'X', status: 'cured' }] },
		]) {
			const res = await call('POST', `${base()}/clinical-records`, doctor.token, body);
			assert.equal(res.status, 400, JSON.stringify(body));
		}
	});

	test('a clinical record adds doctor-entered findings that both dashboards show', async () => {
		const res = await call('POST', `${base()}/clinical-records`, doctor.token, {
			consultationDate: '2024-01-15',
			facility: 'City Clinic',
			diagnoses: [{ name: 'Essential hypertension', status: 'present' }, { name: 'Asthma', status: 'possible' }],
			prescriptions: [{ name: 'Amlodipine', dose: '5 mg', frequency: 'once daily', action: 'start' }],
			investigations: [{ name: 'Blood pressure', value: '150/95', unit: 'mmHg' }],
			observations: 'Patient reports occasional headaches.',
		});
		assert.equal(res.status, 201, JSON.stringify(res.body));
		const { record } = res.body.data;
		assert.equal(record.findings.length, 4);
		for (const f of record.findings) {
			assert.equal(f.sourceType, 'doctor_entered');
			assert.equal(f.verificationStatus, 'doctor_verified');
			assert.equal(f.reviewStatus, 'confirmed');
			assert.equal(f.eventDate, '2024-01-15');
			assert.equal(f.documentId, record.id); // listed under the record
		}
		const amlodipine = record.findings.find((f) => f.category === 'medication');
		assert.equal(amlodipine.dose, '5 mg');
		assert.equal(amlodipine.action, 'start');

		for (const view of [await call('GET', `${base()}/records`, doctor.token), await call('GET', '/api/me/records', patient.token)]) {
			const entry = view.body.data.documents.find((d) => d.id === record.id);
			assert.equal(entry.kind, 'clinical_record');
			assert.equal(entry.documentDate, '2024-01-15');
			assert.equal(entry.clinicalRecord.doctorName, 'Dr Review');
			assert.match(entry.clinicalRecord.observations, /headaches/);
			assert.equal(view.body.data.findings.filter((f) => f.documentId === record.id).length, 4);
		}
		await assert.rejects(pool.query('UPDATE clinical_records SET facility = $2 WHERE id = $1', [record.id, 'Other']), /append-only/);
		const audit = await pool.query(`SELECT details FROM audit_logs WHERE action = 'clinical_record.create' AND resource_id = $1`, [record.id]);
		assert.equal(audit.rows[0].details.items, 4);
	});
});
