const { getDb } = require('../../db/connection');

const EVENT_COLUMNS = `
  e.id,
  e.household_id,
  e.member_id,
  e.title,
  e.start_at,
  e.end_at,
  e.is_all_day,
  e.location,
  e.description,
  e.source,
  e.external_id,
  e.created_at,
  e.updated_at,
  e.deleted_at,
  hm.name AS member_name`;

const findMemberInHousehold = async (householdId, memberId, db = null) => {
  const database = db || (await getDb());

  return database.get(
    `SELECT id, household_id, user_id, role, can_manage_household
     FROM household_members
     WHERE household_id = ? AND id = ?`,
    [householdId, memberId],
  );
};

const findUserMembership = async (householdId, userId, db = null) => {
  const database = db || (await getDb());

  return database.get(
    `SELECT id, household_id, user_id, role, can_manage_household
     FROM household_members
     WHERE household_id = ? AND user_id = ?`,
    [householdId, userId],
  );
};

const findUserMembershipsByUserId = async (userId, db = null) => {
  const database = db || (await getDb());

  return database.all(
    `SELECT id, household_id, user_id, role, can_manage_household
     FROM household_members
     WHERE user_id = ?
     ORDER BY household_id ASC, id ASC`,
    [userId],
  );
};

const findHouseholdMemberByUserId = async (householdId, userId, db = null) => {
  const database = db || (await getDb());

  return database.get(
    `SELECT id, household_id, user_id, role, can_manage_household
     FROM household_members
     WHERE household_id = ? AND user_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [householdId, userId],
  );
};

const createEventTx = async (
  db,
  {
    householdId,
    memberId,
    title = '',
    startAt,
    endAt,
    isAllDay = false,
    location = null,
    description = null,
    source = 'manual',
    externalId = null,
  },
) => {
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO events
      (
        household_id,
        member_id,
        title,
        start_at,
        end_at,
        is_all_day,
        location,
        description,
        source,
        external_id,
        created_at,
        updated_at,
        deleted_at
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      householdId,
      memberId,
      title,
      startAt,
      endAt,
      isAllDay ? 1 : 0,
      location,
      description,
      source,
      externalId,
      now,
      now,
    ],
  );

  return result.lastID;
};

const getEventById = async (eventId, db = null) => {
  const database = db || (await getDb());

  return database.get(
    `SELECT ${EVENT_COLUMNS}
     FROM events e
     INNER JOIN household_members hm ON hm.id = e.member_id
     WHERE e.id = ?`,
    [eventId],
  );
};

const listEventsByHousehold = async (
  householdId,
  { startAt = null, endAt = null, includeDeleted = false } = {},
  db = null,
) => {
  const database = db || (await getDb());
  const conditions = ['e.household_id = ?'];
  const params = [householdId];

  if (!includeDeleted) {
    conditions.push('e.deleted_at IS NULL');
  }

  if (Number.isFinite(startAt)) {
    conditions.push('e.end_at > ?');
    params.push(startAt);
  }

  if (Number.isFinite(endAt)) {
    conditions.push('e.start_at < ?');
    params.push(endAt);
  }

  return database.all(
    `SELECT ${EVENT_COLUMNS}
     FROM events e
     INNER JOIN household_members hm ON hm.id = e.member_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.start_at ASC, e.id ASC`,
    params,
  );
};

const findHouseholdMembersByHouseholdId = async (householdId, db = null) => {
  const database = db || (await getDb());

  return database.all(
    `SELECT id, household_id, user_id, name, role, can_manage_household
     FROM household_members
     WHERE household_id = ?
     ORDER BY id ASC`,
    [householdId],
  );
};

const updateEventTx = async (
  db,
  { eventId, memberId, title, startAt, endAt, isAllDay = false, location = null, description = null },
) => {
  const now = Date.now();

  await db.run(
    `UPDATE events
     SET
      member_id = ?,
      title = ?,
      start_at = ?,
      end_at = ?,
      is_all_day = ?,
      location = ?,
      description = ?,
      updated_at = ?
     WHERE id = ?`,
    [memberId, title, startAt, endAt, isAllDay ? 1 : 0, location, description, now, eventId],
  );
};

const softDeleteEventTx = async (db, { eventId, deletedAt }) => {
  const now = Date.now();

  const result = await db.run(
    `UPDATE events
     SET deleted_at = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [deletedAt, now, eventId],
  );

  return result.changes;
};

const upsertSyncedEventTx = async (
  db,
  {
    householdId,
    memberId,
    title = '',
    startAt,
    endAt,
    isAllDay = false,
    location = null,
    description = null,
    source = 'sync',
    externalId = null,
  },
) => {
  const now = Date.now();

  if (!externalId) {
    return createEventTx(db, {
      householdId,
      memberId,
      title,
      startAt,
      endAt,
      isAllDay,
      location,
      description,
      source,
      externalId,
    });
  }

  const existing = await db.get(
    `SELECT id FROM events
     WHERE household_id = ? AND source = ? AND external_id = ?`,
    [householdId, source, externalId],
  );

  if (!existing) {
    return createEventTx(db, {
      householdId,
      memberId,
      title,
      startAt,
      endAt,
      isAllDay,
      location,
      description,
      source,
      externalId,
    });
  }

  await db.run(
    `UPDATE events
     SET
      member_id = ?,
      title = ?,
      start_at = ?,
      end_at = ?,
      is_all_day = ?,
      location = ?,
      description = ?,
      updated_at = ?,
      deleted_at = NULL
     WHERE id = ?`,
    [memberId, title, startAt, endAt, isAllDay ? 1 : 0, location, description, now, existing.id],
  );

  return existing.id;
};

const findAccessibleHouseholdIdsByUserId = async (userId, db = null) => {
  const database = db || (await getDb());

  const rows = await database.all(
    `SELECT DISTINCT household_id
     FROM household_members
     WHERE user_id = ?`,
    [userId],
  );

  return rows.map((row) => row.household_id);
};

const getUnresolvedConflictsByHouseholdIds = async (householdIds, db = null) => {
  if (!householdIds.length) {
    return [];
  }

  const database = db || (await getDb());
  const placeholders = householdIds.map(() => '?').join(', ');

  return database.all(
    `SELECT
      c.id,
      c.household_id,
      c.event_id_1,
      c.event_id_2,
      c.conflict_type,
      c.detected_at,
      c.resolved,
      e1.member_id AS member_id,
      e1.start_at AS event_1_start_at,
      e1.end_at AS event_1_end_at,
      e1.title AS event_1_title,
      e2.start_at AS event_2_start_at,
      e2.end_at AS event_2_end_at,
      e2.title AS event_2_title
    FROM conflicts c
    INNER JOIN events e1 ON e1.id = c.event_id_1
    INNER JOIN events e2 ON e2.id = c.event_id_2
    WHERE c.resolved = 0
      AND c.household_id IN (${placeholders})
      AND e1.deleted_at IS NULL
      AND e2.deleted_at IS NULL
    ORDER BY c.detected_at DESC, c.id DESC`,
    householdIds,
  );
};

module.exports = {
  findMemberInHousehold,
  findUserMembership,
  findUserMembershipsByUserId,
  findHouseholdMemberByUserId,
  getEventById,
  listEventsByHousehold,
  findHouseholdMembersByHouseholdId,
  createEventTx,
  updateEventTx,
  softDeleteEventTx,
  upsertSyncedEventTx,
  findAccessibleHouseholdIdsByUserId,
  getUnresolvedConflictsByHouseholdIds,
};
