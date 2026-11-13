export const notFoundHandler = (req, res) => {
	res.status(404).json({
		error: 'Not Found',
		message: `No route matches ${req.method} ${req.path}.`,
	});
};

export const errorHandler = (error, _req, res, next) => {
	if (res.headersSent) return next(error);

	const status = error.status === 413 ? 413 : Number(error.status) >= 400 && Number(error.status) < 600
		? Number(error.status)
		: 500;
	if (status >= 500) console.error('Request failed:', error.message);

	res.status(status).json({
		error: status === 413 ? 'Payload Too Large' : status >= 500 ? 'Internal Server Error' : 'Request Error',
		message: status >= 500 ? 'The request could not be completed.' : error.message,
	});
};
