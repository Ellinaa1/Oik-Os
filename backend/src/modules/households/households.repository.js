const { getDb } = require('../../db/connection');

const createHouseholdTx = async (db, { name, createdByUserId }) => {
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO households (name, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [name, createdByUserId, now, now],
  );

  return result.lastID;
};

const createHouseholdMemberTx = async (
  db,
  { householdId, userId = null, name, role, dateOfBirth = null, canManageHousehold },
) => {
  const now = Date.now();

  const result = await db.run(
    `INSERT INTO household_members
      (household_id, user_id, name, role, date_of_birth, can_manage_household, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [householdId, userId, name, role, dateOfBirth, canManageHousehold ? 1 : 0, now, now],
  );

  return result.lastID;
};

const getHouseholdWithMembersById = async (householdId, db = null) => {
  const database = db || (await getDb());

  const household = await database.get(
    `SELECT id, name, created_by_user_id, created_at, updated_at
     FROM households
     WHERE id = ?`,
    [householdId],
  );

  if (!household) {
    return null;
  }

  const members = await database.all(
    `SELECT id, household_id, user_id, name, role, date_of_birth, can_manage_household, created_at, updated_at
     FROM household_members
     WHERE household_id = ?
     ORDER BY id ASC`,
    [householdId],
  );

  return {
    ...household,
    members,
  };
};

module.exports = {
  createHouseholdTx,
  createHouseholdMemberTx,
  getHouseholdWithMembersById,
};
