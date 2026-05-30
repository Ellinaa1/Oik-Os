const path = require('path');

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseNumber(process.env.PORT, 4000),
  appBaseUrl: process.env.APP_BASE_URL || 'https://app.oikos.com',
  databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db'),
  bcryptSaltRounds: parseNumber(process.env.BCRYPT_SALT_ROUNDS, 12),
  verificationTtlMs: 24 * 60 * 60 * 1000,
  emailFrom: process.env.EMAIL_FROM || 'noreply@oikos.com',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseNumber(process.env.SMTP_PORT, 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
};

module.exports = { env };
