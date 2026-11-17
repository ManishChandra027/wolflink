import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export function requireAuth(config) {
  return async (req, res, next) => {
    const token = req.cookies?.wl_access;
    if (!token) {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' },
      });
    }

    let payload;
    try {
      payload = jwt.verify(token, config.accessTokenSecret, {
        algorithms: ['HS256'],
        issuer: 'wolflink-api',
        audience: 'wolflink-client',
      });
      if (payload.type !== 'access' || typeof payload.sub !== 'string') throw new Error('Invalid access token.');
    } catch {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Your session has expired. Please sign in again.' },
      });
    }

    try {
      const user = await User.findById(payload.sub).select('_id');
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } });
      req.auth = { userId: payload.sub };
      return next();
    } catch {
      return res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Your session has expired. Please sign in again.' },
      });
    }
  };
}

export function requireVerifiedEmail() {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.auth?.userId).select('emailVerified');
      if (!user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } });
      if (!user.emailVerified) return res.status(403).json({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email in Account Settings before starting a conversation.' } });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
