import type { MemberPreferences } from '@/types/preferences';

const API_BASE = '/api/v1/members/me/preferences';

class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message) {
      return payload.message;
    }
  } catch {
    // noop
  }

  return `Request failed with status ${response.status}`;
};

const parseJsonPayload = async <T>(response: Response): Promise<T> => {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected API response format. Expected JSON.');
  }

  return (await response.json()) as T;
};

const normalizePreferences = (value: unknown): MemberPreferences => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const notificationRaw =
    raw.notification_preferences && typeof raw.notification_preferences === 'object'
      ? (raw.notification_preferences as Record<string, unknown>)
      : {};

  return {
    notificationPreferences: {
      push: Boolean(notificationRaw.push),
      sms: Boolean(notificationRaw.sms),
      morningBriefingTime:
        typeof notificationRaw.morning_briefing_time === 'string'
          ? notificationRaw.morning_briefing_time
          : '08:00',
    },
    timezone: typeof raw.timezone === 'string' && raw.timezone.trim() ? raw.timezone : 'UTC',
  };
};

const serializePreferences = (preferences: MemberPreferences): Record<string, unknown> => {
  return {
    timezone: preferences.timezone,
    notification_preferences: {
      push: preferences.notificationPreferences.push,
      sms: preferences.notificationPreferences.sms,
      morning_briefing_time: preferences.notificationPreferences.morningBriefingTime,
    },
  };
};

export const getMyPreferences = async (): Promise<MemberPreferences> => {
  const response = await fetch(API_BASE);

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return normalizePreferences(await parseJsonPayload<unknown>(response));
};

export const updateMyPreferences = async (
  preferences: MemberPreferences,
): Promise<MemberPreferences> => {
  const response = await fetch(API_BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializePreferences(preferences)),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  return normalizePreferences(await parseJsonPayload<unknown>(response));
};
