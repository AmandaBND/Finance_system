/**
 * Phase 1 SaaS: new tables + company_id on tenant tables. Idempotent.
 */
const SEED_COMPANY_ID = 'groovymark-seed';

const TABLES_WITH_COMPANY_ID = [
  'settings',
  'clients',
  'revenue',
  'invoices',
  'invoice_items',
  'expenses',
  'employees',
  'salary_payments',
  'recurring_payments',
  'notifications',
  'budget',
  'ai_cache',
  'client_credentials',
  'payment_gateway_settings',
  'payment_slips',
  'online_payments',
  'employee_credentials',
  'employee_leaves',
  'employee_leave_requests',
  'employee_kpi',
  'project_types',
  'projects',
  'tasks',
  'task_resources',
  'calendar_events',
  'employee_notices',
  'birthday_wishes',
];

function columnExists(db, table, col) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => r.name === col);
}

function runSaasMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      plan TEXT NOT NULL DEFAULT 'free',
      owner_id TEXT,
      first_login INTEGER NOT NULL DEFAULT 1,
      heard_from TEXT,
      trial_ends_at DATETIME,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'owner',
      google_uid TEXT UNIQUE,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS signup_pending (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      otp_expires_at DATETIME NOT NULL,
      company_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      heard_from TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS platform_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT,
      actor_email TEXT,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_user_login_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS superadmin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  for (const table of TABLES_WITH_COMPANY_ID) {
    try {
      if (!columnExists(db, table, 'company_id')) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN company_id TEXT NOT NULL DEFAULT '${SEED_COMPANY_ID}'`);
      }
    } catch (e) {
      /* table may not exist in very old DBs */
      console.warn(`SaaS migrate: skip ${table}.company_id`, e.message);
    }
  }

  db.prepare(`
    INSERT OR IGNORE INTO companies (id, name, email, plan, first_login, status, trial_ends_at)
    VALUES (?, 'GroovyMark', 'finance@groovymark.com', 'enterprise', 0, 'active', datetime('now', '+365 days'))
  `).run(SEED_COMPANY_ID);

  try {
    db.prepare(`UPDATE settings SET company_id=? WHERE id=1 AND (company_id IS NULL OR company_id='')`).run(SEED_COMPANY_ID);
  } catch (_) {}

  try {
    db.prepare(`UPDATE payment_gateway_settings SET company_id=? WHERE id=1 AND (company_id IS NULL OR company_id='')`).run(SEED_COMPANY_ID);
  } catch (_) {}

  try {
    db.prepare(`UPDATE ai_cache SET company_id=? WHERE id=1`).run(SEED_COMPANY_ID);
  } catch (_) {}

  console.log('✅ SaaS Phase 1 migrations applied');
}

module.exports = { runSaasMigrations, SEED_COMPANY_ID, TABLES_WITH_COMPANY_ID };
