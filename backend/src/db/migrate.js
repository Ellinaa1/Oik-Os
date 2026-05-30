const hasColumn = async (db, tableName, columnName) => {
  const columns = await db.all(`PRAGMA table_info(${tableName});`);
  return columns.some((column) => column.name === columnName);
};

const ensureColumn = async (db, tableName, columnName, definition) => {
  if (await hasColumn(db, tableName, columnName)) {
    return;
  }

  await db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
};

const runMigrations = async (db) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await ensureColumn(db, 'users', 'preferences_json', "JSONB NOT NULL DEFAULT '{}'");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);',
  );

  await db.exec(`
    CREATE TABLE IF NOT EXISTS households (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS household_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id INTEGER NOT NULL,
      user_id INTEGER,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      date_of_birth TEXT,
      can_manage_household INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);',
  );

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);',
  );

  await db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      start_at INTEGER NOT NULL,
      end_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      external_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES household_members(id) ON DELETE CASCADE
    );
  `);

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_events_household_member_time ON events(household_id, member_id, start_at, end_at);',
  );

  await db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_events_sync_unique ON events(household_id, source, external_id) WHERE external_id IS NOT NULL;',
  );

  await ensureColumn(db, 'events', 'is_all_day', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'events', 'location', 'TEXT');
  await ensureColumn(db, 'events', 'description', 'TEXT');
  await ensureColumn(db, 'events', 'deleted_at', 'INTEGER');

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_events_household_deleted_time ON events(household_id, deleted_at, start_at);',
  );

  await db.exec(`
    CREATE TABLE IF NOT EXISTS conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id INTEGER NOT NULL,
      event_id_1 INTEGER NOT NULL,
      event_id_2 INTEGER NOT NULL,
      conflict_type TEXT NOT NULL,
      detected_at INTEGER NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id_1) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id_2) REFERENCES events(id) ON DELETE CASCADE,
      CHECK (event_id_1 < event_id_2)
    );
  `);

  await db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_conflicts_unique_pair ON conflicts(household_id, event_id_1, event_id_2, conflict_type);',
  );

  await db.exec(
    'CREATE INDEX IF NOT EXISTS idx_conflicts_household_resolved ON conflicts(household_id, resolved);',
  );
};

module.exports = { runMigrations };
