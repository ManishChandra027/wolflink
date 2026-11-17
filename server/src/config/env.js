const required = [
  'NODE_ENV',
  'PORT',
  'CLIENT_ORIGIN',
  'MONGODB_URI',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'OTP_HASH_SECRET',
];

export function loadConfig(env = process.env) {
  const missing = required.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  if (!['development', 'test', 'production'].includes(env.NODE_ENV)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  if (env.ACCESS_TOKEN_SECRET.length < 32 || env.REFRESH_TOKEN_SECRET.length < 32) {
    throw new Error('JWT secrets must each be at least 32 characters long.');
  }
  if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) {
    throw new Error('Access and refresh JWT secrets must be different.');
  }
  if (env.OTP_HASH_SECRET.length < 32) {
    throw new Error('OTP_HASH_SECRET must be at least 32 characters long.');
  }

  const smtpValues = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'];
  const smtpConfigured = smtpValues.some((key) => Boolean(env[key]?.trim()));
  if (smtpConfigured && smtpValues.some((key) => !env[key]?.trim())) {
    throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM must be configured together.');
  }
  const smtpPort = smtpConfigured ? Number(env.SMTP_PORT) : undefined;
  if (smtpConfigured && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }
  const smtpPassword = env.SMTP_PASSWORD || env.SMTP_PASS;
  if (env.SMTP_PASSWORD && env.SMTP_PASS && env.SMTP_PASSWORD !== env.SMTP_PASS) {
    throw new Error('SMTP_PASSWORD and SMTP_PASS must match when both are configured.');
  }
  const hasSmtpUser = Boolean(env.SMTP_USER?.trim());
  const hasSmtpPassword = Boolean(smtpPassword?.trim());
  if (hasSmtpUser !== hasSmtpPassword) {
    throw new Error('SMTP_USER and an SMTP password (SMTP_PASSWORD or SMTP_PASS) must be configured together.');
  }
  const smtpAuthConfigured = hasSmtpUser && hasSmtpPassword;
  if (smtpAuthConfigured && !smtpConfigured) {
    throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM are required when SMTP authentication is configured.');
  }
  if (env.SMTP_SECURE !== undefined && !['true', 'false'].includes(env.SMTP_SECURE.toLowerCase())) {
    throw new Error('SMTP_SECURE must be true or false.');
  }

  const cookieSameSite = (env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  if (!['strict', 'lax', 'none'].includes(cookieSameSite)) {
    throw new Error('COOKIE_SAME_SITE must be strict, lax, or none.');
  }
  const cookieSecure = env.COOKIE_SECURE === undefined
    ? env.NODE_ENV === 'production'
    : env.COOKIE_SECURE.toLowerCase() === 'true';
  if (env.COOKIE_SECURE !== undefined && !['true', 'false'].includes(env.COOKIE_SECURE.toLowerCase())) {
    throw new Error('COOKIE_SECURE must be true or false.');
  }
  if (env.NODE_ENV === 'production' && !cookieSecure) {
    throw new Error('Production authentication cookies must set COOKIE_SECURE=true.');
  }

  const cloudinaryKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const cloudinaryConfigured = cloudinaryKeys.some((key) => Boolean(env[key]?.trim()));
  if (cloudinaryConfigured && cloudinaryKeys.some((key) => !env[key]?.trim())) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be configured together.');
  }
  if (cookieSameSite === 'none' && !cookieSecure) {
    throw new Error('SameSite=None cookies require COOKIE_SECURE=true.');
  }

  let clientOrigin;
  let mongoUri;
  try {
    const parsedOrigin = new URL(env.CLIENT_ORIGIN);
    if (parsedOrigin.origin !== env.CLIENT_ORIGIN.replace(/\/$/, '')) {
      throw new Error('CLIENT_ORIGIN must contain only an origin, without a path.');
    }
    clientOrigin = parsedOrigin.origin;
    mongoUri = new URL(env.MONGODB_URI);
  } catch {
    throw new Error('CLIENT_ORIGIN and MONGODB_URI must be valid URLs.');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(mongoUri.protocol)) {
    throw new Error('MONGODB_URI must use mongodb:// or mongodb+srv://.');
  }

  return {
    nodeEnv: env.NODE_ENV,
    port,
    clientOrigin,
    mongoUri: env.MONGODB_URI,
    accessTokenSecret: env.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
    otpHashSecret: env.OTP_HASH_SECRET,
    smtpHost: env.SMTP_HOST?.trim() || null,
    smtpPort,
    smtpSecure: env.SMTP_SECURE?.toLowerCase() === 'true' || smtpPort === 465,
    smtpUser: smtpAuthConfigured ? env.SMTP_USER.trim() : null,
    smtpPassword: smtpAuthConfigured ? smtpPassword : null,
    smtpFrom: env.SMTP_FROM?.trim() || null,
    cloudinaryCloudName: env.CLOUDINARY_CLOUD_NAME?.trim() || null,
    cloudinaryApiKey: env.CLOUDINARY_API_KEY?.trim() || null,
    cloudinaryApiSecret: env.CLOUDINARY_API_SECRET?.trim() || null,
    cookieSameSite,
    cookieSecure,
  };
}
