/**
 * DEVELOPMENT ONLY: create a doctor account for local testing.
 *
 * In the MVP design (section 5.3) a doctor registers and a hospital admin
 * verifies them. The hospital admin page is not built yet, so this script
 * stands in for both steps. Do not use it for real accounts.
 *
 *   npm run doctor:create -- --email dr.mehta@example.test --password "a-long-password" \
 *     --name "Dr. Mehta" --license MCI-12345 [--status verified|pending|rejected|revoked]
 */
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const args = Object.fromEntries(
	process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);

const usage = () => {
	console.error('Usage: npm run doctor:create -- --email <email> --password <password> --name "<full name>" --license <licence no> [--status verified]');
	process.exit(1);
};

const { email, password, name, license, status = 'verified' } = args;
if (!email || !password || !name || !license) usage();
if (password.length < 8) {
	console.error('Password must be at least 8 characters.');
	process.exit(1);
}
if (!['verified', 'pending', 'rejected', 'revoked'].includes(status)) usage();

try {
	const hash = await bcrypt.hash(password, 12);
	const { rows } = await pool.query(
		`INSERT INTO doctors (full_name, email, password_hash, license_number, verification_status, verified_at)
		 VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'verified' THEN now() END)
		 RETURNING id, full_name, email, verification_status`,
		[name.trim(), email.trim().toLowerCase(), hash, license.trim(), status],
	);
	console.log(`Created doctor ${rows[0].full_name} <${rows[0].email}> (${rows[0].verification_status}), id ${rows[0].id}`);
	console.log('Development account only: in the real flow a hospital admin verifies doctors.');
} catch (error) {
	if (error.code === '23505') console.error('A doctor with this email or licence number already exists.');
	else console.error(`Could not create the doctor: ${error.message}`);
	process.exitCode = 1;
} finally {
	await pool.end();
}
