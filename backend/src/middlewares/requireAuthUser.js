const { HttpError } = require('../utils/httpError');
const { getDb } = require('../db/connection');

const decodeJwtPayload = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
};

const parseUserIdFromRequest = (req) => {
  const headerUserId = req.header('x-user-id');
  if (headerUserId && /^\d+$/.test(String(headerUserId).trim())) {
    return Number(headerUserId);
  }

  const authHeader = req.header('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = decodeJwtPayload(token);
    const subject = payload && payload.sub;

    if ((typeof subject === 'string' || typeof subject === 'number') && /^\d+$/.test(String(subject))) {
      return Number(subject);
    }
  }

  return null;
};

const requireAuthUser = async (req, res, next) => {
  const userId = parseUserIdFromRequest(req);

  if (!userId) {
    return next(new HttpError(401, 'Authentication required.'));
  }

  const db = await getDb();
  const user = await db.get('SELECT id, email, is_verified FROM users WHERE id = ?', [userId]);

  if (!user) {
    return next(new HttpError(401, 'Authenticated user not found.'));
  }

  req.user = user;
  return next();
};

module.exports = { requireAuthUser };
