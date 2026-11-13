import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const unauthorized = (res) =>
	res.status(401).json({
		error: { code: 'UNAUTHORIZED', message: 'A valid patient access token is required.' },
	});

export const requirePatientAuth = (req, res, next) => {
	const authorization = req.get('authorization') || '';
	const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
	if (!match) return unauthorized(res);

	try {
		const claims = jwt.verify(match[1], env.jwtSecret, {
			algorithms: ['HS256'],
			issuer: 'osco-api',
			audience: 'osco-patient',
		});

		if (
			typeof claims === 'string' ||
			claims.role !== 'patient' ||
			typeof claims.sub !== 'string' ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.sub)
		) {
			return unauthorized(res);
		}

		req.auth = { patientId: claims.sub };
		return next();
	} catch {
		return unauthorized(res);
	}
};
