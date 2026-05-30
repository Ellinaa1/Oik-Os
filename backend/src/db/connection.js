const path = require('path');
const fs = require('fs/promises');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { env } = require('../config/env');
const { runMigrations } = require('./migrate');

let dbInstance;

const initDb = async () => {
  if (dbInstance) {
    return dbInstance;
  }

  const dbDir = path.dirname(env.databasePath);
  await fs.mkdir(dbDir, { recursive: true });

  dbInstance = await open({
    filename: env.databasePath,
    driver: sqlite3.Database,
  });

  await dbInstance.exec('PRAGMA foreign_keys = ON;');
  await runMigrations(dbInstance);

  return dbInstance;
};

const getDb = async () => {
  if (!dbInstance) {
    await initDb();
  }

  return dbInstance;
};

module.exports = {
  initDb,
  getDb,
};
