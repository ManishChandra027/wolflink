import { HttpError } from '../errors/HttpError.js';

async function createTransport(config) {
  if (!config.smtpHost) {
    throw new HttpError(503, 'EMAIL_NOT_CONFIGURED', 'Email delivery is not configured yet. Please try again later.');
  }

  let nodemailer;
  try {
    ({ default: nodemailer } = await import('nodemailer'));
  } catch {
    throw new HttpError(503, 'EMAIL_SERVICE_UNAVAILABLE', 'Email delivery is unavailable right now. Please try again later.');
  }

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

function logSmtpFailure(event, error) {
  console.error(JSON.stringify({
    event,
    code: typeof error?.code === 'string' ? error.code : 'UNKNOWN',
    responseCode: Number.isInteger(error?.responseCode) ? error.responseCode : undefined,
    command: typeof error?.command === 'string' ? error.command : undefined,
  }));
}

export async function sendEmail(config, { to, subject, text, html }) {
  const transporter = await createTransport(config);

  try {
    const result = await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject,
      text,
      html,
    });
    if (Array.isArray(result.accepted) && result.accepted.length === 0) {
      throw Object.assign(new Error('SMTP server did not accept the recipient.'), { code: 'RECIPIENT_NOT_ACCEPTED' });
    }
  } catch (error) {
    logSmtpFailure('smtp.send_failed', error);
    throw new HttpError(503, 'EMAIL_DELIVERY_FAILED', 'We could not send the verification email. Please retry later.');
  } finally {
    transporter.close();
  }
}

export async function verifySmtpTransport(config) {
  const transporter = await createTransport(config);
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    logSmtpFailure('smtp.verify_failed', error);
    throw new HttpError(503, 'SMTP_VERIFY_FAILED', 'SMTP connection or authentication failed. Check the sanitized server diagnostic.');
  } finally {
    transporter.close();
  }
}

export function sendVerificationEmail(config, { to, otp }) {
  return sendEmail(config, {
    to,
    subject: 'Verify your WolfLink email',
    text: `Your WolfLink verification code is ${otp}. It expires in 10 minutes. If you did not create this account, you can ignore this email.`,
    html: `<p>Your WolfLink verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. If you did not create this account, you can ignore this email.</p>`,
  });
}

export function sendPasswordResetEmail(config, { to, otp }) {
  return sendEmail(config, {
    to,
    subject: 'Your WolfLink password reset code',
    text: `Your WolfLink password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your WolfLink password reset code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
}
