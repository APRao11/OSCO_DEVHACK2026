import { Router } from 'express';
import { pool } from '../config/db.js';
import { requirePatientAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requirePatientAuth, async (req, res, next) => {
	try {
		const result = await pool.query(
			`SELECT id, full_name, email, created_at, public_id
			 FROM patients
			 WHERE id = $1
			 LIMIT 1`,
			[req.auth.patientId],
		);
		const patient = result.rows[0];
		if (!patient) {
			return res.status(401).json({
				error: { code: 'UNAUTHORIZED', message: 'This patient account is no longer available.' },
			});
		}

		return res.status(200).json({
			data: {
				patient: {
					id: patient.id,
					name: patient.full_name,
					email: patient.email,
					createdAt: patient.created_at,
					publicId: patient.public_id,
				},
			},
		});
	} catch (error) {
		return next(error);
	}
});

export default router;
