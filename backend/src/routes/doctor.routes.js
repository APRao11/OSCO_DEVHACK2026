import { Router } from 'express';
import { doctorOnly } from '../middleware/requireVerifiedDoctor.js';

/**
 * Doctor-only routes. The guard is applied to the whole router, so every route
 * added here re-checks the doctor's verification status in the database on
 * each request (section 7.1). A revoked doctor is blocked on the next request.
 */
const router = Router();

router.use(...doctorOnly);

/** Confirms the caller is a currently verified doctor. */
router.get('/me', (req, res) => {
	res.status(200).json({ data: { doctor: req.doctor } });
});

export default router;
