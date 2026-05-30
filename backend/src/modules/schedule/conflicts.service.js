const { getDb } = require('../../db/connection');

const CONFLICT_TYPE_TIME_OVERLAP = 'time_overlap';

const detectConflictsForHousehold = async ({ householdId, db = null }) => {
  const database = db || (await getDb());
  const detectedAt = Date.now();

  const overlaps = await database.all(
    `SELECT
      e1.household_id,
      e1.id AS event_id_1,
      e2.id AS event_id_2
     FROM events e1
     INNER JOIN events e2
     ON e1.household_id = e2.household_id
      AND e1.member_id = e2.member_id
      AND e1.id < e2.id
     WHERE e1.household_id = ?
       AND e1.deleted_at IS NULL
       AND e2.deleted_at IS NULL
       AND e1.start_at < e2.end_at
       AND e1.end_at > e2.start_at`,
    [householdId],
  );

  for (const row of overlaps) {
    await database.run(
      `INSERT OR IGNORE INTO conflicts
        (household_id, event_id_1, event_id_2, conflict_type, detected_at, resolved)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [row.household_id, row.event_id_1, row.event_id_2, CONFLICT_TYPE_TIME_OVERLAP, detectedAt],
    );
  }

  await database.run(
    `UPDATE conflicts
     SET resolved = 1
     WHERE household_id = ?
       AND resolved = 0
       AND conflict_type = ?
       AND NOT EXISTS (
        SELECT 1
        FROM events e1
        INNER JOIN events e2 ON e2.id = conflicts.event_id_2
        WHERE e1.id = conflicts.event_id_1
          AND e1.household_id = conflicts.household_id
          AND e2.household_id = conflicts.household_id
          AND e1.deleted_at IS NULL
          AND e2.deleted_at IS NULL
          AND e1.member_id = e2.member_id
          AND e1.start_at < e2.end_at
          AND e1.end_at > e2.start_at
      )`,
    [householdId, CONFLICT_TYPE_TIME_OVERLAP],
  );
};

module.exports = {
  CONFLICT_TYPE_TIME_OVERLAP,
  detectConflictsForHousehold,
};
