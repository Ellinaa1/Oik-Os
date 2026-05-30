const { HttpError } = require('../../utils/httpError');
const { findUserPreferencesById, updateUserPreferencesById } = require('./members.repository');

const DEFAULT_PREFERENCES = {
  notification_preferences: {
    push: true,
    sms: false,
    morning_briefing_time: '08:00',
  },
  timezone: 'UTC',
};

const isPlainObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const parseStoredPreferences = (value) => {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const isValidIanaTimezone = (value) => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const normalizeMorningBriefingTime = (value) => {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return DEFAULT_PREFERENCES.notification_preferences.morning_briefing_time;
  }

  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    throw new HttpError(400, 'notification_preferences.morning_briefing_time must be in HH:mm format.');
  }

  const [hours, minutes] = normalized.split(':').map((item) => Number(item));
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
    throw new HttpError(400, 'notification_preferences.morning_briefing_time has invalid hour.');
  }

  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    throw new HttpError(400, 'notification_preferences.morning_briefing_time has invalid minute.');
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const normalizeBoolean = (value, fieldName, fallback) => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  throw new HttpError(400, `${fieldName} must be a boolean.`);
};

const normalizePreferences = (rawValue) => {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const notificationRaw = isPlainObject(source.notification_preferences)
    ? source.notification_preferences
    : {};

  const timezoneRaw = source.timezone ?? DEFAULT_PREFERENCES.timezone;
  const timezone = String(timezoneRaw || '').trim() || DEFAULT_PREFERENCES.timezone;

  if (!isValidIanaTimezone(timezone)) {
    throw new HttpError(400, 'timezone must be a valid IANA timezone string.');
  }

  const normalized = {
    notification_preferences: {
      push: normalizeBoolean(
        notificationRaw.push,
        'notification_preferences.push',
        DEFAULT_PREFERENCES.notification_preferences.push,
      ),
      sms: normalizeBoolean(
        notificationRaw.sms,
        'notification_preferences.sms',
        DEFAULT_PREFERENCES.notification_preferences.sms,
      ),
      morning_briefing_time: normalizeMorningBriefingTime(notificationRaw.morning_briefing_time),
    },
    timezone,
  };

  return normalized;
};

const mergePreferences = (base, patch) => {
  const mergedNotification = {
    ...base.notification_preferences,
    ...(isPlainObject(patch.notification_preferences) ? patch.notification_preferences : {}),
  };

  return {
    ...base,
    ...(isPlainObject(patch) ? patch : {}),
    notification_preferences: mergedNotification,
  };
};

const getMyPreferences = async ({ user }) => {
  const row = await findUserPreferencesById(user.id);

  if (!row) {
    throw new HttpError(404, 'User not found.');
  }

  const stored = parseStoredPreferences(row.preferences_json);
  const normalized = normalizePreferences(mergePreferences(DEFAULT_PREFERENCES, stored));

  return {
    statusCode: 200,
    preferences: normalized,
  };
};

const updateMyPreferences = async ({ user, payload }) => {
  if (!isPlainObject(payload)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }

  const existing = await findUserPreferencesById(user.id);
  if (!existing) {
    throw new HttpError(404, 'User not found.');
  }

  const current = normalizePreferences(
    mergePreferences(DEFAULT_PREFERENCES, parseStoredPreferences(existing.preferences_json)),
  );
  const next = normalizePreferences(mergePreferences(current, payload));

  await updateUserPreferencesById(user.id, JSON.stringify(next));

  return {
    statusCode: 200,
    preferences: next,
  };
};

module.exports = {
  getMyPreferences,
  updateMyPreferences,
};
