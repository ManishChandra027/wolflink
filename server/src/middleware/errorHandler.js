export function errorHandler(error, _req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = status >= 500 ? 'INTERNAL_ERROR' : (error.code || 'REQUEST_ERROR');
  const message = status >= 500 ? 'Something went wrong.' : error.message;

  if (status >= 500) console.error(`Unhandled API error (${error.name}).`);
  res.status(status).json({ error: { code, message } });
}
