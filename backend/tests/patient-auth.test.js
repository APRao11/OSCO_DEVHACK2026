import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/osco_test';
process.env.JWT_SECRET ||= 'unit-test-only-secret-material-0123456789abcdef';

const [{ createApp }, { pool }] = await Promise.all([
  import('../src/server.js'),
  import('../src/config/db.js'),
]);

const patients = new Map();
const originalQuery = pool.query.bind(pool);
pool.query = async (query, params = []) => {
  if (query.includes('INSERT INTO patients')) {
    const [fullName, email, passwordHash] = params;
    if ([...patients.values()].some((patient) => patient.email.toLowerCase() === email.toLowerCase())) {
      const error = new Error('duplicate key');
      error.code = '23505';
      error.constraint = 'patients_email_lower_unique';
      throw error;
    }
    const patient = {
      id: randomUUID(),
      full_name: fullName,
      email,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
    };
    patients.set(patient.id, patient);
    return { rows: [{ ...patient }], rowCount: 1 };
  }

  if (query.includes('FROM patients') && query.includes('lower(email)')) {
    const patient = [...patients.values()].find((item) => item.email.toLowerCase() === params[0]);
    return { rows: patient ? [{ ...patient }] : [], rowCount: patient ? 1 : 0 };
  }

  if (query.includes('FROM patients') && query.includes('WHERE id = $1')) {
    const patient = patients.get(params[0]);
    return {
      rows: patient ? [{
        id: patient.id,
        full_name: patient.full_name,
        email: patient.email,
        created_at: patient.created_at,
      }] : [],
      rowCount: patient ? 1 : 0,
    };
  }

  throw new Error('Unexpected SQL in auth test.');
};

const app = createApp();
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  pool.query = originalQuery;
  await pool.end();
});

const postJson = (path, body) => fetch(`${baseUrl}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('registers a patient with a password hash and safe token response', async () => {
  const response = await postJson('/api/auth/patient/register', {
    name: 'Test Patient',
    email: 'test.patient@example.invalid',
    password: 'unit-test-password-42',
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.ok(body.data.token);
  assert.deepEqual(Object.keys(body.data.patient).sort(), ['createdAt', 'email', 'id', 'name']);
  assert.equal(body.data.patient.email, 'test.patient@example.invalid');
  assert.equal('password_hash' in body.data.patient, false);
  assert.equal('password' in body.data.patient, false);

  const stored = patients.get(body.data.patient.id);
  assert.notEqual(stored.password_hash, 'unit-test-password-42');
  assert.equal(await bcrypt.compare('unit-test-password-42', stored.password_hash), true);
});

test('rejects duplicate registration case-insensitively', async () => {
  const response = await postJson('/api/auth/patient/register', {
    name: 'Duplicate Test',
    email: 'TEST.PATIENT@example.invalid',
    password: 'unit-test-password-42',
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error.code, 'ACCOUNT_EXISTS');
});

test('logs in with a correct password and rejects an incorrect password', async () => {
  const success = await postJson('/api/auth/patient/login', {
    email: 'test.patient@example.invalid',
    password: 'unit-test-password-42',
  });
  const successBody = await success.json();
  assert.equal(success.status, 200);
  assert.ok(successBody.data.token);

  const failure = await postJson('/api/auth/patient/login', {
    email: 'test.patient@example.invalid',
    password: 'wrong-password-42',
  });
  const failureBody = await failure.json();
  assert.equal(failure.status, 401);
  assert.equal(failureBody.error.code, 'INVALID_CREDENTIALS');

  const unknownAccount = await postJson('/api/auth/patient/login', {
    email: 'not-registered@example.invalid',
    password: 'unit-test-password-42',
  });
  assert.equal(unknownAccount.status, 401);
});

test('requires a valid token to read the patient profile', async () => {
  const login = await postJson('/api/auth/patient/login', {
    email: 'test.patient@example.invalid',
    password: 'unit-test-password-42',
  });
  const { data } = await login.json();

  const authorized = await fetch(`${baseUrl}/api/patients/me`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });
  const profile = await authorized.json();
  assert.equal(authorized.status, 200);
  assert.equal(profile.data.patient.id, data.patient.id);
  assert.equal('password_hash' in profile.data.patient, false);

  const unauthorized = await fetch(`${baseUrl}/api/patients/me`);
  const unauthorizedBody = await unauthorized.json();
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorizedBody.error.code, 'UNAUTHORIZED');
});
