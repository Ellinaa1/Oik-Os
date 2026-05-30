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

const parsePositiveInteger = (value) => {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const extractHouseholdIdFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rawValue = payload.household_id ?? payload.householdId ?? payload.hid;
  return parsePositiveInteger(rawValue);
};

const parseAuthContextFromRequest = (req) => {
  let userId = parsePositiveInteger(req.header('x-user-id'));
  let householdId = parsePositiveInteger(req.header('x-household-id'));

  const authHeader = req.header('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = decodeJwtPayload(token);
    const subject = payload?.sub;

    if (!userId && (typeof subject === 'string' || typeof subject === 'number')) {
      userId = parsePositiveInteger(subject);
    }

    if (!householdId) {
      householdId = extractHouseholdIdFromPayload(payload);
    }
  }

  return { userId, householdId };
};

const requireAuthUser = async (req, res, next) => {
  const authContext = parseAuthContextFromRequest(req);
  const userId = authContext.userId;

  if (!userId) {
    return next(new HttpError(401, 'Authentication required.'));
  }

  const db = await getDb();
  const user = await db.get('SELECT id, email, is_verified FROM users WHERE id = ?', [userId]);

  if (!user) {
    return next(new HttpError(401, 'Authenticated user not found.'));
  }

  req.user = {
    ...user,
    householdId: authContext.householdId,
  };

  return next();
};

module.exports = { requireAuthUser };
