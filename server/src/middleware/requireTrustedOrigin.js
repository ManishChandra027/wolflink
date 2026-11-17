export function requireTrustedOrigin(clientOrigin) {
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin && origin !== clientOrigin) {
      return res.status(403).json({
        error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This request origin is not allowed.' },
      });
    }
    next();
  };
}
