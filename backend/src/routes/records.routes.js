import { Router } from 'express';
import { requirePatientAuth } from '../middleware/auth.js';
import { buildPatientRecords } from '../services/records.service.js';

/** GET /api/me/records: the logged-in patient's medical history (see records.service.js). */
const router = Router();

router.get('/records', requirePatientAuth, async (req, res, next) => {
	try {
		const data = await buildPatientRecords(req.auth.patientId, { fileUrl: (id) => `/api/documents/${id}/file` });
		return res.status(200).json({ data });
	} catch (error) {
		return next(error);
	}
});

export default router;
