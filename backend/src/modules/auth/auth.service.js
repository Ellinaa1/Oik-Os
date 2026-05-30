const bcrypt = require('bcryptjs');
const { env } = require('../../config/env');
const { HttpError } = require('../../utils/httpError');
const { generateVerificationToken, hashToken } = require('../../utils/crypto');
const {
  createUser,
  findUserByEmail,
  markUserAsVerified,
  deleteVerificationTokensByUserId,
  createVerificationToken,
  findVerificationTokenWithUser,
} = require('./auth.repository');
const { sendVerificationEmail } = require('../email/email.service');

const isValidEmail = (email) => /.+@.+\..+/.test(email);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const createAndSendVerificationToken = async ({ userId, email }) => {
  const rawToken = generateVerificationToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = Date.now() + env.verificationTtlMs;

  await deleteVerificationTokensByUserId(userId);
  await createVerificationToken({ userId, tokenHash, expiresAt });
  await sendVerificationEmail({ to: email, rawToken });
};

const register = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    throw new HttpError(400, 'A valid email is required.');
  }

  if (!normalizedPassword || normalizedPassword.length < 8) {
    throw new HttpError(400, 'Password must contain at least 8 characters.');
  }

  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser && existingUser.is_verified) {
    throw new HttpError(409, 'Account already exists and is verified.');
  }

  if (existingUser && !existingUser.is_verified) {
    await createAndSendVerificationToken({ userId: existingUser.id, email: existingUser.email });

    return {
      statusCode: 200,
      message: 'Verification email re-sent. Please check your inbox.',
    };
  }

  const passwordHash = await bcrypt.hash(normalizedPassword, env.bcryptSaltRounds);
  const newUser = await createUser({ email: normalizedEmail, passwordHash });

  await createAndSendVerificationToken({ userId: newUser.id, email: newUser.email });

  return {
    statusCode: 201,
    message: 'Registration successful. Verification email sent.',
  };
};

const verifyEmail = async ({ token }) => {
  const rawToken = String(token || '').trim();
  if (!rawToken) {
    throw new HttpError(400, 'token query parameter is required.');
  }

  const tokenHash = hashToken(rawToken);
  const tokenRecord = await findVerificationTokenWithUser(tokenHash);

  if (!tokenRecord) {
    throw new HttpError(400, 'Invalid verification token.');
  }

  if (tokenRecord.is_verified) {
    return {
      statusCode: 200,
      message: 'Account is already verified.',
    };
  }

  if (tokenRecord.expires_at < Date.now()) {
    throw new HttpError(410, 'Verification token has expired.');
  }

  await markUserAsVerified(tokenRecord.user_id);

  return {
    statusCode: 200,
    message: 'Email verified successfully.',
  };
};

module.exports = {
  register,
  verifyEmail,
};
