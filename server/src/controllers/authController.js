import {
  accessCookieName,
  accessMaxAge,
  refreshCookieName,
  refreshMaxAge,
} from '../services/tokenService.js';
import * as authService from '../services/authService.js';

function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
  };
}

function issueCookies(res, session, config) {
  res.cookie(accessCookieName, session.accessToken, {
    ...cookieOptions(config),
    path: '/',
    maxAge: accessMaxAge,
  });
  res.cookie(refreshCookieName, session.refreshToken, {
    ...cookieOptions(config),
    path: '/api/auth',
    maxAge: refreshMaxAge,
  });
}

function clearCookies(res, config) {
  res.clearCookie(accessCookieName, { ...cookieOptions(config), path: '/' });
  res.clearCookie(refreshCookieName, { ...cookieOptions(config), path: '/api/auth' });
}

export function register(config, sendEmail) {
  return async (req, res) => {
    try {
      const result = await authService.register(req.body, config, sendEmail);
      issueCookies(res, result, config);
      res.status(201).json({ data: { user: result.user, email: result.email, verificationEmailSent: result.verificationEmailSent, message: result.verificationEmailSent ? 'Check your email for a verification code. You can skip this step and verify later in Account Settings.' : 'Your account is ready. Email delivery is unavailable; you can retry verification in Account Settings.' } });
    } catch (error) {
      if (['EMAIL_NOT_CONFIGURED', 'EMAIL_SERVICE_UNAVAILABLE', 'EMAIL_DELIVERY_FAILED'].includes(error.code)) {
        return res.status(503).json({
          error: {
            code: 'EMAIL_DELIVERY_FAILED',
            message: 'Your account was created, but we could not send the verification email. Configure or retry email delivery before verifying.',
          },
        });
      }
      throw error;
    }
  };
}

export function resendVerification(config, sendEmail) {
  return async (req, res) => {
    try {
      const result = await authService.resendEmailVerification(req.auth.userId, config, sendEmail);
      res.status(202).json({ data: result });
    } catch (error) {
      if (['EMAIL_NOT_CONFIGURED', 'EMAIL_SERVICE_UNAVAILABLE', 'EMAIL_DELIVERY_FAILED'].includes(error.code)) {
        return res.status(503).json({
          error: { code: 'EMAIL_DELIVERY_FAILED', message: 'We could not send the verification email. Configure or retry email delivery before trying again.' },
        });
      }
      throw error;
    }
  };
}

export function verifyEmail(config) {
  return async (req, res) => {
    const result = await authService.verifyEmail(req.auth.userId, req.body, config);
    res.json({ data: result });
  };
}

export function login(config) {
  return async (req, res) => {
    const session = await authService.login(req.body, config);
    issueCookies(res, session, config);
    res.json({ data: { user: session.user } });
  };
}

export function refresh(config) {
  return async (req, res) => {
    const session = await authService.refreshSession(req.cookies?.[refreshCookieName], config);
    issueCookies(res, session, config);
    res.json({ data: { user: session.user } });
  };
}

export function logout(config) {
  return async (req, res) => {
    await authService.logout(req.cookies?.[refreshCookieName], config);
    clearCookies(res, config);
    res.json({ data: { message: 'You are signed out.' } });
  };
}

export function me(req, res) {
  res.json({ data: { user: req.currentUser } });
}

export async function loadMe(req, _res, next) {
  try {
    req.currentUser = await authService.getCurrentUser(req.auth.userId);
    next();
  } catch (error) {
    next(error);
  }
}

export function requestPasswordReset(config, sendEmail) {
  return async (req, res) => {
    try {
      const result = await authService.requestPasswordReset(req.body.email, config, sendEmail);
      res.status(202).json({ data: result });
    } catch (error) {
      if (['EMAIL_NOT_CONFIGURED', 'EMAIL_SERVICE_UNAVAILABLE', 'EMAIL_DELIVERY_FAILED'].includes(error.code)) {
        return res.status(202).json({ data: { message: 'If an account exists for that email, a reset code will be sent.' } });
      }
      throw error;
    }
  };
}

export function verifyPasswordReset(config) {
  return async (req, res) => res.json({ data: await authService.verifyPasswordResetOtp(req.body, config) });
}

export function resetPassword(_config) {
  return async (req, res) => res.json({ data: await authService.resetPassword(req.body) });
}

export function changePassword(config) {
  return async (req, res) => {
    const result = await authService.changePassword(req.auth.userId, req.body);
    clearCookies(res, config);
    res.json({ data: result });
  };
}
