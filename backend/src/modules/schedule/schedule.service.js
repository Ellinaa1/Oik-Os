const { HttpError } = require('../../utils/httpError');
const { getDb } = require('../../db/connection');
const {
  findMemberInHousehold,
  findUserMembership,
  findUserMembershipsByUserId,
  findHouseholdMemberByUserId,
  createEventTx,
  getEventById,
  listEventsByHousehold,
  findHouseholdMembersByHouseholdId,
  updateEventTx,
  softDeleteEventTx,
  upsertSyncedEventTx,
  findAccessibleHouseholdIdsByUserId,
  getUnresolvedConflictsByHouseholdIds,
} = require('./schedule.repository');
const { detectConflictsForHousehold } = require('./conflicts.service');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const readField = (payload, snakeKey, camelKey) => {
  if (hasOwn(payload, snakeKey)) {
    return payload[snakeKey];
  }

  if (hasOwn(payload, camelKey)) {
    return payload[camelKey];
  }

  return undefined;
};

const hasField = (payload, snakeKey, camelKey) => {
  return hasOwn(payload, snakeKey) || hasOwn(payload, camelKey);
};

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseTimestamp = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  const timestamp =
    typeof value === 'number' && Number.isFinite(value) ? value : Date.parse(String(value).trim());

  if (!Number.isFinite(timestamp)) {
    throw new HttpError(400, `${fieldName} must be a valid datetime.`);
  }

  return timestamp;
};

const parseOptionalTimestamp = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }

  return parseTimestamp(value, fieldName);
};

const parseRequiredText = (value, fieldName) => {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  return normalized;
};

const parseOptionalText = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
};

const parseBooleanFlag = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new HttpError(400, 'is_all_day must be a boolean value.');
};

const ensureMemberAccess = async ({ db, householdId, memberId, userId }) => {
  const requestorMembership = await findUserMembership(householdId, userId, db);

  if (!requestorMembership) {
    throw new HttpError(403, 'You are not a member of this household.');
  }

  const targetMember = await findMemberInHousehold(householdId, memberId, db);
  if (!targetMember) {
    throw new HttpError(404, 'Member not found in household.');
  }
};

const resolveScopedHouseholdId = async ({ db, user, payloadHouseholdId = null }) => {
  const householdIdFromToken = toPositiveInteger(user?.householdId);
  const householdIdFromPayload = toPositiveInteger(payloadHouseholdId);
  const scopedHouseholdId = householdIdFromToken || householdIdFromPayload;

  if (scopedHouseholdId) {
    const membership = await findUserMembership(scopedHouseholdId, user.id, db);

    if (!membership) {
      throw new HttpError(403, 'You are not a member of this household.');
    }

    return scopedHouseholdId;
  }

  const memberships = await findUserMembershipsByUserId(user.id, db);

  if (!memberships.length) {
    throw new HttpError(403, 'You are not a member of any household.');
  }

  if (memberships.length > 1) {
    throw new HttpError(
      400,
      'Household scope is ambiguous. Provide household_id in JWT claim or x-household-id header.',
    );
  }

  return memberships[0].household_id;
};

const serializeEvent = (row) => {
  return {
    id: row.id,
    householdId: row.household_id,
    memberId: row.member_id,
    memberName: row.member_name,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    isAllDay: Boolean(row.is_all_day),
    location: row.location,
    description: row.description,
    source: row.source,
    externalId: row.external_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
};

const createEvent = async ({ payload, creatorUser }) => {
  const title = parseRequiredText(payload?.title, 'title');
  const startAt = parseTimestamp(readField(payload, 'start_at', 'startAt'), 'start_at');
  const endAt = parseTimestamp(readField(payload, 'end_at', 'endAt'), 'end_at');
  const isAllDay = parseBooleanFlag(readField(payload, 'is_all_day', 'isAllDay'), false);
  const location = parseOptionalText(payload?.location);
  const description = parseOptionalText(payload?.description);
  const requestedMemberId = toPositiveInteger(readField(payload, 'member_id', 'memberId'));

  if (endAt <= startAt) {
    throw new HttpError(400, 'end_at must be greater than start_at.');
  }

  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');

  try {
    const householdId = await resolveScopedHouseholdId({
      db,
      user: creatorUser,
      payloadHouseholdId: readField(payload, 'household_id', 'householdId'),
    });

    const memberId = requestedMemberId || (await findHouseholdMemberByUserId(householdId, creatorUser.id, db))?.id;

    if (!memberId) {
      throw new HttpError(400, 'member_id is required for this household.');
    }

    await ensureMemberAccess({ db, householdId, memberId, userId: creatorUser.id });

    const eventId = await createEventTx(db, {
      householdId,
      memberId,
      title,
      startAt,
      endAt,
      isAllDay,
      location,
      description,
      source: 'manual',
      externalId: null,
    });

    await detectConflictsForHousehold({ householdId, db });
    const event = await getEventById(eventId, db);

    await db.exec('COMMIT;');

    return {
      statusCode: 201,
      event: serializeEvent(event),
    };
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }
};

const syncEvents = async ({ payload, user }) => {
  const events = Array.isArray(payload?.events) ? payload.events : null;

  if (!events) {
    throw new HttpError(400, 'events must be an array.');
  }

  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');

  try {
    const householdId = await resolveScopedHouseholdId({
      db,
      user,
      payloadHouseholdId: readField(payload, 'household_id', 'householdId'),
    });

    const requesterMembership = await findUserMembership(householdId, user.id, db);

    if (!requesterMembership || !requesterMembership.can_manage_household) {
      throw new HttpError(403, 'Only household managers can sync events.');
    }

    const syncedEventIds = [];

    for (let index = 0; index < events.length; index += 1) {
      const row = events[index] || {};
      const memberId = toPositiveInteger(readField(row, 'member_id', 'memberId'));
      const startAt = parseTimestamp(readField(row, 'start_at', 'startAt'), `events[${index}].start_at`);
      const endAt = parseTimestamp(readField(row, 'end_at', 'endAt'), `events[${index}].end_at`);
      const isAllDay = parseBooleanFlag(readField(row, 'is_all_day', 'isAllDay'), false);

      if (!memberId) {
        throw new HttpError(400, `events[${index}].member_id must be a positive integer.`);
      }

      if (endAt <= startAt) {
        throw new HttpError(400, `events[${index}].end_at must be greater than start_at.`);
      }

      const member = await findMemberInHousehold(householdId, memberId, db);
      if (!member) {
        throw new HttpError(404, `events[${index}] member not found in household.`);
      }

      const eventId = await upsertSyncedEventTx(db, {
        householdId,
        memberId,
        title: String(row.title || '').trim(),
        startAt,
        endAt,
        isAllDay,
        location: parseOptionalText(row.location),
        description: parseOptionalText(row.description),
        source: String(row.source || 'sync').trim() || 'sync',
        externalId: row.externalId ? String(row.externalId) : null,
      });

      syncedEventIds.push(eventId);
    }

    await detectConflictsForHousehold({ householdId, db });

    await db.exec('COMMIT;');

    return {
      statusCode: 200,
      syncedEventIds,
    };
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }
};

const listEvents = async ({ query, user }) => {
  const startAt = parseOptionalTimestamp(
    query?.from ?? readField(query || {}, 'start_at', 'startAt'),
    'start_at',
  );
  const endAt = parseOptionalTimestamp(query?.to ?? readField(query || {}, 'end_at', 'endAt'), 'end_at');

  if (startAt && endAt && endAt <= startAt) {
    throw new HttpError(400, 'end_at must be greater than start_at.');
  }

  const db = await getDb();
  const householdId = await resolveScopedHouseholdId({
    db,
    user,
    payloadHouseholdId: query?.household_id ?? query?.householdId,
  });

  const [events, members] = await Promise.all([
    listEventsByHousehold(householdId, { startAt, endAt }, db),
    findHouseholdMembersByHouseholdId(householdId, db),
  ]);

  return {
    statusCode: 200,
    householdId,
    members: members.map((member) => ({
      id: member.id,
      householdId: member.household_id,
      userId: member.user_id,
      name: member.name,
      role: member.role,
      canManageHousehold: Boolean(member.can_manage_household),
    })),
    events: events.map(serializeEvent),
  };
};

const updateEvent = async ({ eventId, payload, user }) => {
  const normalizedEventId = toPositiveInteger(eventId);

  if (!normalizedEventId) {
    throw new HttpError(400, 'id path param must be a positive integer.');
  }

  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');

  try {
    const existing = await getEventById(normalizedEventId, db);

    if (!existing || existing.deleted_at) {
      throw new HttpError(404, 'Event not found.');
    }

    if (existing.source !== 'manual') {
      throw new HttpError(400, 'Only manual events can be edited.');
    }

    const membership = await findUserMembership(existing.household_id, user.id, db);
    if (!membership) {
      throw new HttpError(403, 'You are not a member of this household.');
    }

    const title = hasField(payload, 'title', 'title')
      ? parseRequiredText(payload?.title, 'title')
      : existing.title;

    const startAt = hasField(payload, 'start_at', 'startAt')
      ? parseTimestamp(readField(payload, 'start_at', 'startAt'), 'start_at')
      : existing.start_at;

    const endAt = hasField(payload, 'end_at', 'endAt')
      ? parseTimestamp(readField(payload, 'end_at', 'endAt'), 'end_at')
      : existing.end_at;

    const isAllDay = hasField(payload, 'is_all_day', 'isAllDay')
      ? parseBooleanFlag(readField(payload, 'is_all_day', 'isAllDay'), false)
      : Boolean(existing.is_all_day);

    const location = hasField(payload, 'location', 'location')
      ? parseOptionalText(payload?.location)
      : existing.location;

    const description = hasField(payload, 'description', 'description')
      ? parseOptionalText(payload?.description)
      : existing.description;

    let memberId = existing.member_id;
    if (hasField(payload, 'member_id', 'memberId')) {
      const requestedMemberId = toPositiveInteger(readField(payload, 'member_id', 'memberId'));

      if (!requestedMemberId) {
        throw new HttpError(400, 'member_id must be a positive integer.');
      }

      memberId = requestedMemberId;
    }

    if (endAt <= startAt) {
      throw new HttpError(400, 'end_at must be greater than start_at.');
    }

    await ensureMemberAccess({ db, householdId: existing.household_id, memberId, userId: user.id });

    await updateEventTx(db, {
      eventId: normalizedEventId,
      memberId,
      title,
      startAt,
      endAt,
      isAllDay,
      location,
      description,
    });

    await detectConflictsForHousehold({ householdId: existing.household_id, db });
    const updated = await getEventById(normalizedEventId, db);

    await db.exec('COMMIT;');

    return {
      statusCode: 200,
      event: serializeEvent(updated),
    };
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }
};

const deleteEvent = async ({ eventId, user }) => {
  const normalizedEventId = toPositiveInteger(eventId);

  if (!normalizedEventId) {
    throw new HttpError(400, 'id path param must be a positive integer.');
  }

  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');

  try {
    const existing = await getEventById(normalizedEventId, db);

    if (!existing || existing.deleted_at) {
      throw new HttpError(404, 'Event not found.');
    }

    const membership = await findUserMembership(existing.household_id, user.id, db);
    if (!membership) {
      throw new HttpError(403, 'You are not a member of this household.');
    }

    const deletedAt = Date.now();
    await softDeleteEventTx(db, { eventId: normalizedEventId, deletedAt });
    await detectConflictsForHousehold({ householdId: existing.household_id, db });

    await db.exec('COMMIT;');

    return {
      statusCode: 200,
      eventId: normalizedEventId,
      deletedAt,
    };
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }
};

const listUnresolvedConflicts = async ({ user }) => {
  const db = await getDb();
  const householdIds = await findAccessibleHouseholdIdsByUserId(user.id, db);
  const conflicts = await getUnresolvedConflictsByHouseholdIds(householdIds, db);

  return {
    statusCode: 200,
    conflicts: conflicts.map((row) => ({
      id: row.id,
      householdId: row.household_id,
      eventId1: row.event_id_1,
      eventId2: row.event_id_2,
      conflictType: row.conflict_type,
      detectedAt: row.detected_at,
      resolved: Boolean(row.resolved),
      memberId: row.member_id,
      event1: {
        startAt: row.event_1_start_at,
        endAt: row.event_1_end_at,
        title: row.event_1_title,
      },
      event2: {
        startAt: row.event_2_start_at,
        endAt: row.event_2_end_at,
        title: row.event_2_title,
      },
    })),
  };
};

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  syncEvents,
  listUnresolvedConflicts,
};
