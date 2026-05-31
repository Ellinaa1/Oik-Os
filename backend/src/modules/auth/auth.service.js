const bcrypt = require('bcrypt');
const { z } = require('zod');
const { HttpError } = require('../../utils/httpError');
const { hashToken } = require('../../utils/crypto');
const {
  createUser,
  findUserByEmail,
  markUserAsVerified,
  findVerificationTokenWithUser,
} = require('./auth.repository');
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.string().trim().email('A valid email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const register = async (payload) => {
  const parsedPayload = registerSchema.safeParse(payload || {});

  if (!parsedPayload.success) {
    throw new HttpError(400, 'Invalid registration payload.', parsedPayload.error.flatten());
  }

  const { name, email, password } = parsedPayload.data;
  const normalizedEmail = email.toLowerCase();

  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new HttpError(409, 'Email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = await createUser({
    name,
    email: normalizedEmail,
    passwordHash,
  });

  return {
    userId: newUser.id,
    email: newUser.email,
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
