const { getDb } = require('../../db/connection');

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

const createEventTx = async (
  db,
  { householdId, memberId, title = '', startAt, endAt, source = 'manual', externalId = null },
) => {
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO events
      (household_id, member_id, title, start_at, end_at, source, external_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [householdId, memberId, title, startAt, endAt, source, externalId, now, now],
  );

  return result.lastID;
};

const upsertSyncedEventTx = async (
  db,
  { householdId, memberId, title = '', startAt, endAt, source = 'sync', externalId = null },
) => {
  const now = Date.now();

  if (!externalId) {
    return createEventTx(db, {
      householdId,
      memberId,
      title,
      startAt,
      endAt,
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
      source,
      externalId,
    });
  }

  await db.run(
    `UPDATE events
     SET member_id = ?, title = ?, start_at = ?, end_at = ?, updated_at = ?
     WHERE id = ?`,
    [memberId, title, startAt, endAt, now, existing.id],
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
    WHERE c.resolved = 0 AND c.household_id IN (${placeholders})
    ORDER BY c.detected_at DESC, c.id DESC`,
    householdIds,
  );
};

module.exports = {
  findMemberInHousehold,
  findUserMembership,
  createEventTx,
  upsertSyncedEventTx,
  findAccessibleHouseholdIdsByUserId,
  getUnresolvedConflictsByHouseholdIds,
};
