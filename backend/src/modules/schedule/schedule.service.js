const { HttpError } = require('../../utils/httpError');
const { getDb } = require('../../db/connection');
const {
  findMemberInHousehold,
  findUserMembership,
  createEventTx,
  upsertSyncedEventTx,
  findAccessibleHouseholdIdsByUserId,
  getUnresolvedConflictsByHouseholdIds,
} = require('./schedule.repository');
const { detectConflictsForHousehold } = require('./conflicts.service');

const parseTimestamp = (value, fieldName) => {
  const input = String(value || '').trim();
  if (!input) {
    throw new HttpError(400, `${fieldName} is required.`);
  }

  const timestamp = Date.parse(input);
  if (!Number.isFinite(timestamp)) {
    throw new HttpError(400, `${fieldName} must be a valid datetime.`);
  }

  return timestamp;
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

const createEvent = async ({ payload, creatorUser }) => {
  const householdId = Number(payload?.householdId);
  const memberId = Number(payload?.memberId);
  const title = String(payload?.title || '').trim();
  const startAt = parseTimestamp(payload?.startAt, 'startAt');
  const endAt = parseTimestamp(payload?.endAt, 'endAt');

  if (!Number.isInteger(householdId) || householdId <= 0) {
    throw new HttpError(400, 'householdId must be a positive integer.');
  }

  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw new HttpError(400, 'memberId must be a positive integer.');
  }

  if (endAt <= startAt) {
    throw new HttpError(400, 'endAt must be greater than startAt.');
  }

  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');

  try {
    await ensureMemberAccess({ db, householdId, memberId, userId: creatorUser.id });

    const eventId = await createEventTx(db, {
      householdId,
      memberId,
      title,
      startAt,
      endAt,
      source: 'manual',
      externalId: null,
    });

    await detectConflictsForHousehold({ householdId, db });

    await db.exec('COMMIT;');

    return {
      statusCode: 201,
      event: {
        id: eventId,
        householdId,
        memberId,
        title,
        startAt,
        endAt,
      },
    };
  } catch (error) {
    await db.exec('ROLLBACK;');
    throw error;
  }
};

const syncEvents = async ({ payload, user }) => {
  const householdId = Number(payload?.householdId);
  const events = Array.isArray(payload?.events) ? payload.events : null;

  if (!Number.isInteger(householdId) || householdId <= 0) {
    throw new HttpError(400, 'householdId must be a positive integer.');
  }

  if (!events) {
    throw new HttpError(400, 'events must be an array.');
  }

  const db = await getDb();
  await db.exec('BEGIN TRANSACTION;');

  try {
    const requesterMembership = await findUserMembership(householdId, user.id, db);

    if (!requesterMembership || !requesterMembership.can_manage_household) {
      throw new HttpError(403, 'Only household managers can sync events.');
    }

    const syncedEventIds = [];

    for (let index = 0; index < events.length; index += 1) {
      const row = events[index] || {};
      const memberId = Number(row.memberId);
      const startAt = parseTimestamp(row.startAt, `events[${index}].startAt`);
      const endAt = parseTimestamp(row.endAt, `events[${index}].endAt`);

      if (!Number.isInteger(memberId) || memberId <= 0) {
        throw new HttpError(400, `events[${index}].memberId must be a positive integer.`);
      }

      if (endAt <= startAt) {
        throw new HttpError(400, `events[${index}].endAt must be greater than startAt.`);
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
  createEvent,
  syncEvents,
  listUnresolvedConflicts,
};
