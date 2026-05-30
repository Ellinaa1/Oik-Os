const nodemailer = require('nodemailer');
const { env } = require('../../config/env');
const { logger } = require('../../config/logger');
const { buildVerificationEmail } = require('./email.templates');

let transporter;
let usingSmtpTransport = false;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  const hasSmtpConfig = Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
  usingSmtpTransport = hasSmtpConfig;

  transporter = hasSmtpConfig
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
      })
    : nodemailer.createTransport({
        jsonTransport: true,
      });

  return transporter;
};

const sendVerificationEmail = async ({ to, rawToken }) => {
  const verificationUrl = `${env.appBaseUrl}/verify?token=${encodeURIComponent(rawToken)}`;
  const { subject, text, html } = buildVerificationEmail({ verificationUrl });

  const mailer = getTransporter();
  await mailer.sendMail({
    from: env.emailFrom,
    to,
    subject,
    text,
    html,
  });

  logger.info('Verification email dispatched', {
    to,
    transport: usingSmtpTransport ? 'smtp' : 'jsonTransport',
    verificationUrl,
  });
};

module.exports = { sendVerificationEmail };
