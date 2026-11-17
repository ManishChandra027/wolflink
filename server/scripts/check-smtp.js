import { loadConfig } from '../src/config/env.js';
import { verifySmtpTransport } from '../src/services/emailService.js';

try {
  const config = loadConfig();
  if (!config.smtpHost) {
    console.error('SMTP_NOT_CONFIGURED');
    process.exitCode = 2;
  } else {
    await verifySmtpTransport(config);
    console.log('SMTP_VERIFY_OK (connection/auth only; no email sent)');
  }
} catch (error) {
  console.error(`SMTP_CHECK_FAILED (${error.code || 'CONFIGURATION_ERROR'}): ${error.message}`);
  process.exitCode = 1;
}
