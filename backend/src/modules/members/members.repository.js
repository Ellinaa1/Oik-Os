const { getDb } = require('../../db/connection');

const findUserPreferencesById = async (userId, db = null) => {
  const database = db || (await getDb());

  return database.get(
    `SELECT id, preferences_json, updated_at
     FROM users
     WHERE id = ?`,
    [userId],
  );
};

const updateUserPreferencesById = async (userId, preferencesJson, db = null) => {
  const database = db || (await getDb());
  const now = Date.now();

  await database.run(
    `UPDATE users
     SET preferences_json = ?, updated_at = ?
     WHERE id = ?`,
    [preferencesJson, now, userId],
  );

  return findUserPreferencesById(userId, database);
};

module.exports = {
  findUserPreferencesById,
  updateUserPreferencesById,
};
