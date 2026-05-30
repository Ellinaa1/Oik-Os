import type { CalendarMember, EventUpsertPayload, ScheduleEvent, ScheduleSnapshot } from '@/types/schedule';

const API_BASE = '/api/v1/schedule/events';

class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
};

const toStringValue = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const fromNumericString = Number(value);
    if (Number.isFinite(fromNumericString)) {
      return fromNumericString;
    }

    const fromDate = Date.parse(value);
    if (Number.isFinite(fromDate)) {
      return fromDate;
    }
  }

  return fallback;
};

const toBooleanValue = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const normalizeEvent = (value: unknown): ScheduleEvent => {
  const raw = asRecord(value);

  return {
    id: toStringValue(raw.id, crypto.randomUUID()),
    householdId: toStringValue(raw.householdId ?? raw.household_id, ''),
    memberId: toStringValue(raw.memberId ?? raw.member_id, ''),
    memberName: toStringValue(raw.memberName ?? raw.member_name, ''),
    title: toStringValue(raw.title, ''),
    startAt: toNumberValue(raw.startAt ?? raw.start_at),
    endAt: toNumberValue(raw.endAt ?? raw.end_at),
    isAllDay: toBooleanValue(raw.isAllDay ?? raw.is_all_day, false),
    location: toStringValue(raw.location, '') || null,
    description: toStringValue(raw.description, '') || null,
    source: toStringValue(raw.source, 'manual'),
    externalId: toStringValue(raw.externalId ?? raw.external_id, '') || null,
    createdAt: toNumberValue(raw.createdAt ?? raw.created_at, 0) || undefined,
    updatedAt: toNumberValue(raw.updatedAt ?? raw.updated_at, 0) || undefined,
    deletedAt:
      raw.deletedAt === null || raw.deleted_at === null
        ? null
        : toNumberValue(raw.deletedAt ?? raw.deleted_at, 0) || undefined,
  };
};

const normalizeMember = (value: unknown): CalendarMember => {
  const raw = asRecord(value);

  return {
    id: toStringValue(raw.id, crypto.randomUUID()),
    householdId: toStringValue(raw.householdId ?? raw.household_id, ''),
    userId: toStringValue(raw.userId ?? raw.user_id, '') || null,
    name: toStringValue(raw.name, 'Unknown member'),
    role: toStringValue(raw.role, 'member'),
    canManageHousehold: toBooleanValue(raw.canManageHousehold ?? raw.can_manage_household, false),
  };
};

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

const serializeEventPayload = (payload: EventUpsertPayload): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    title: payload.title,
    start_at: payload.startAt,
    end_at: payload.endAt,
    is_all_day: payload.isAllDay,
  };

  if (payload.memberId) {
    body.member_id = Number(payload.memberId);
  }

  if (payload.location && payload.location.trim()) {
    body.location = payload.location.trim();
  }

  if (payload.description && payload.description.trim()) {
    body.description = payload.description.trim();
  }

  return body;
};

export const listScheduleEvents = async (): Promise<ScheduleSnapshot> => {
  const response = await fetch(API_BASE);

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  const payload = asRecord(await parseJsonPayload<unknown>(response));
  const membersRaw = Array.isArray(payload.members) ? payload.members : [];
  const eventsRaw = Array.isArray(payload.events) ? payload.events : [];

  return {
    householdId: toStringValue(payload.householdId ?? payload.household_id, ''),
    members: membersRaw.map(normalizeMember),
    events: eventsRaw.map(normalizeEvent),
  };
};

export const createManualEvent = async (payload: EventUpsertPayload): Promise<ScheduleEvent> => {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializeEventPayload(payload)),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  const data = asRecord(await parseJsonPayload<unknown>(response));
  return normalizeEvent(data.event ?? data);
};

export const updateScheduleEvent = async (
  eventId: string,
  payload: EventUpsertPayload,
): Promise<ScheduleEvent> => {
  const response = await fetch(`${API_BASE}/${eventId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializeEventPayload(payload)),
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }

  const data = asRecord(await parseJsonPayload<unknown>(response));
  return normalizeEvent(data.event ?? data);
};

export const deleteScheduleEvent = async (eventId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/${eventId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response), response.status);
  }
};
