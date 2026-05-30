export type EventSource = 'manual' | string;

export interface CalendarMember {
  id: string;
  householdId: string;
  userId?: string | null;
  name: string;
  role: string;
  canManageHousehold: boolean;
}

export interface ScheduleEvent {
  id: string;
  householdId: string;
  memberId: string;
  memberName?: string;
  title: string;
  startAt: number;
  endAt: number;
  isAllDay: boolean;
  location?: string | null;
  description?: string | null;
  source: EventSource;
  externalId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface EventUpsertPayload {
  title: string;
  startAt: number;
  endAt: number;
  memberId?: string;
  isAllDay: boolean;
  location?: string;
  description?: string;
}

export interface ScheduleSnapshot {
  householdId: string;
  members: CalendarMember[];
  events: ScheduleEvent[];
}
