import type { Household, Invite, InviteMemberPayload, Member } from '@/types/household';

const API_BASE = '/api/v1/households/me';

class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

const toString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback;
};

const normalizeMember = (input: unknown): Member => {
  const raw = (input || {}) as Record<string, unknown>;

  return {
    id: String(raw.id ?? raw.userId ?? crypto.randomUUID()),
    name: toString(raw.name, toString(raw.fullName, 'Unknown Member')),
    email: toString(raw.email, ''),
    avatarUrl: toString(raw.avatarUrl ?? raw.avatar, '') || null,
    role: toString(raw.role, 'member').toLowerCase(),
  };
};

const normalizeInvite = (input: unknown): Invite => {
  const raw = (input || {}) as Record<string, unknown>;
  const status = toString(raw.status, 'pending').toLowerCase();

  return {
    id: String(raw.id ?? raw.inviteId ?? crypto.randomUUID()),
    email: toString(raw.email, 'unknown@example.com'),
    role: toString(raw.role, 'member').toLowerCase(),
    status,
    invitedByName: toString(raw.invitedByName, ''),
    createdAt: toString(raw.createdAt, ''),
  };
};

const extractErrorMessage = async (response: Response): Promise<string> => {
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

const parseHousehold = (payload: unknown): Household => {
  const root = (payload || {}) as Record<string, unknown>;
  const householdRaw = (root.household ?? root) as Record<string, unknown>;

  const membersRaw = Array.isArray(householdRaw.members) ? householdRaw.members : [];
  const pendingInvitesRaw = Array.isArray(householdRaw.pendingInvites)
    ? householdRaw.pendingInvites
    : Array.isArray(householdRaw.invites)
      ? (householdRaw.invites as unknown[]).filter((invite) => {
          const item = invite as Record<string, unknown>;
          return toString(item.status, 'pending').toLowerCase() === 'pending';
        })
      : [];

  return {
    id: String(householdRaw.id ?? 'me'),
    name: toString(householdRaw.name, 'My Household'),
    members: membersRaw.map(normalizeMember),
    pendingInvites: pendingInvitesRaw.map(normalizeInvite),
  };
};

export const getMyHousehold = async (): Promise<Household> => {
  const response = await fetch(API_BASE);

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const payload = (await response.json()) as unknown;
  return parseHousehold(payload);
};

export const sendHouseholdInvite = async (payload: InviteMemberPayload): Promise<Invite> => {
  const response = await fetch(`${API_BASE}/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }

  const data = (await response.json()) as { invite?: unknown } | unknown;
  const inviteRaw = (data as { invite?: unknown }).invite ?? data;
  return normalizeInvite(inviteRaw);
};

export const cancelHouseholdInvite = async (inviteId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/invites/${inviteId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }
};
