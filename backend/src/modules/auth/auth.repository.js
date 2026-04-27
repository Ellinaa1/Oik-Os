const { getDb } = require('../../db/connection');

const createUser = async ({ email, passwordHash }) => {
  const db = await getDb();
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO users (email, password_hash, is_verified, created_at, updated_at)
     VALUES (?, ?, 0, ?, ?)`,
    [email, passwordHash, now, now],
  );

  return {
    id: result.lastID,
    email,
    is_verified: 0,
  };
};

const findUserByEmail = async (email) => {
  const db = await getDb();
  return db.get('SELECT * FROM users WHERE email = ?', [email]);
};

const markUserAsVerified = async (userId) => {
  const db = await getDb();
  const now = Date.now();

  await db.run('UPDATE users SET is_verified = 1, updated_at = ? WHERE id = ?', [now, userId]);
};

const deleteVerificationTokensByUserId = async (userId) => {
  const db = await getDb();
  await db.run('DELETE FROM email_verification_tokens WHERE user_id = ?', [userId]);
};

const createVerificationToken = async ({ userId, tokenHash, expiresAt }) => {
  const db = await getDb();
  const now = Date.now();

  await db.run(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    [userId, tokenHash, expiresAt, now],
  );
};

const findVerificationTokenWithUser = async (tokenHash) => {
  const db = await getDb();

  return db.get(
    `SELECT
      evt.id AS token_id,
      evt.user_id,
      evt.token_hash,
      evt.expires_at,
      u.id,
      u.email,
      u.password_hash,
      u.is_verified,
      u.created_at,
      u.updated_at
    FROM email_verification_tokens evt
    INNER JOIN users u ON u.id = evt.user_id
    WHERE evt.token_hash = ?`,
    [tokenHash],
  );
};

module.exports = {
  createUser,
  findUserByEmail,
  markUserAsVerified,
  deleteVerificationTokensByUserId,
  createVerificationToken,
  findVerificationTokenWithUser,
};
