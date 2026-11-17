import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

const issuer = 'wolflink-api';
const audience = 'wolflink-client';
export const accessCookieName = 'wl_access';
export const refreshCookieName = 'wl_refresh';
export const accessMaxAge = 15 * 60 * 1000;
export const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createTokenPair(userId, config) {
  const accessToken = jwt.sign({ type: 'access' }, config.accessTokenSecret, {
    algorithm: 'HS256',
    audience,
    expiresIn: '15m',
    issuer,
    subject: userId,
  });
  const refreshToken = jwt.sign({ type: 'refresh' }, config.refreshTokenSecret, {
    algorithm: 'HS256',
    audience,
    expiresIn: '7d',
    issuer,
    jwtid: randomUUID(),
    subject: userId,
  });

  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token, config) {
  const payload = jwt.verify(token, config.refreshTokenSecret, {
    algorithms: ['HS256'],
    issuer,
    audience,
  });
  if (payload.type !== 'refresh' || typeof payload.sub !== 'string') throw new Error('Invalid refresh token.');
  return payload;
}

export function verifyAnyRefreshToken(token, config) {
  try {
    return verifyRefreshToken(token, config);
  } catch {
    return null;
  }
}
