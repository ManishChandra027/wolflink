import { rateLimit } from "express-rate-limit";
import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireTrustedOrigin } from "../middleware/requireTrustedOrigin.js";
import { validateBody } from "../middleware/validateBody.js";
import {
  changePasswordSchema,
  loginSchema,
  passwordResetSchema,
  registerSchema,
  resetOtpSchema,
  resetRequestSchema,
  verifyEmailSchema,
} from "../validation/authSchemas.js";

function makeAuthLimiter(limit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many attempts. Please try again later.",
        },
      }),
  });
}

export function authRoutes(
  config,
  { sendEmail, sendPasswordResetEmail = sendEmail } = {},
) {
  const router = Router();
  const loginLimiter = makeAuthLimiter(10);
  const refreshLimiter = makeAuthLimiter(30);
  const verificationLimiter = makeAuthLimiter(5);
  const resetLimiter = makeAuthLimiter(5);
  const changePasswordLimiter = makeAuthLimiter(5);

  router.use(requireTrustedOrigin(config.clientOrigin));
  router.post(
    "/register",
    loginLimiter,
    validateBody(registerSchema),
    authController.register(config, sendEmail),
  );
  router.post(
    "/verify-email",
    requireAuth(config),
    verificationLimiter,
    validateBody(verifyEmailSchema),
    authController.verifyEmail(config),
  );
  router.post(
    "/resend-verification",
    requireAuth(config),
    verificationLimiter,
    authController.resendVerification(config, sendEmail),
  );
  router.post(
    "/login",
    loginLimiter,
    validateBody(loginSchema),
    authController.login(config),
  );
  router.post(
    "/password-reset/request",
    resetLimiter,
    validateBody(resetRequestSchema),
    authController.requestPasswordReset(config, sendPasswordResetEmail),
  );
  router.post(
    "/password-reset/verify",
    resetLimiter,
    validateBody(resetOtpSchema),
    authController.verifyPasswordReset(config),
  );
  router.post(
    "/password-reset/confirm",
    resetLimiter,
    validateBody(passwordResetSchema),
    authController.resetPassword(config),
  );
  router.post(
    "/change-password",
    requireAuth(config),
    changePasswordLimiter,
    validateBody(changePasswordSchema),
    authController.changePassword(config),
  );
  router.post("/refresh", refreshLimiter, authController.refresh(config));
  router.post("/logout", authController.logout(config));
  router.get(
    "/me",
    requireAuth(config),
    authController.loadMe,
    authController.me,
  );
  return router;
}
