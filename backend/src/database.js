const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../data/financial.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT DEFAULT 'GroovyMark',
      company_email TEXT DEFAULT 'finance@groovymark.com',
      company_phone TEXT,
      company_address TEXT,
      company_website TEXT,
      currency TEXT DEFAULT 'LKR',
      currency_symbol TEXT DEFAULT 'Rs.',
      logo_path TEXT,
      smtp_host TEXT DEFAULT 'smtp.hostinger.com',
      smtp_port INTEGER DEFAULT 465,
      smtp_secure INTEGER DEFAULT 1,
      smtp_user TEXT DEFAULT 'finance@groovymark.com',
      smtp_pass TEXT DEFAULT 'FGMacc2026#',
      openai_key TEXT,
      invoice_prefix TEXT DEFAULT 'INV',
      salary_prefix TEXT DEFAULT 'SAL',
      invoice_terms TEXT DEFAULT 'Payment is due within 30 days of invoice date.',
      invoice_notes TEXT,
      auto_send_invoices INTEGER DEFAULT 1,
      auto_send_reminders INTEGER DEFAULT 1,
      reminder_days_before INTEGER DEFAULT 3,
      overdue_check_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      address TEXT,
      country TEXT DEFAULT 'Sri Lanka',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS revenue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      project_name TEXT,
      service_type TEXT,
      invoice_number TEXT,
      recurring_payment_id INTEGER,
      invoice_date DATE,
      due_date DATE,
      amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT DEFAULT 'Pending',
      payment_method TEXT,
      is_recurring INTEGER DEFAULT 0,
      billing_cycle TEXT DEFAULT 'One-time',
      currency TEXT DEFAULT 'LKR',
      notes TEXT,
      auto_recorded INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_address TEXT,
      client_company TEXT,
      issue_date DATE NOT NULL,
      due_date DATE NOT NULL,
      subtotal REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'Draft',
      notes TEXT,
      terms TEXT,
      paid_date DATE,
      pdf_path TEXT,
      email_sent INTEGER DEFAULT 0,
      email_sent_at DATETIME,
      reminder_count INTEGER DEFAULT 0,
      last_reminder_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      vendor TEXT,
      amount REAL NOT NULL DEFAULT 0,
      payment_date DATE,
      payment_method TEXT,
      is_recurring INTEGER DEFAULT 0,
      billing_cycle TEXT,
      receipt_path TEXT,
      notes TEXT,
      currency TEXT DEFAULT 'LKR',
      recurring_payment_id INTEGER,
      salary_payment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      position TEXT,
      department TEXT,
      email TEXT,
      phone TEXT,
      salary_type TEXT DEFAULT 'Monthly',
      base_salary REAL DEFAULT 0,
      start_date DATE,
      status TEXT DEFAULT 'Active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS salary_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      employee_name TEXT NOT NULL,
      position TEXT,
      department TEXT,
      salary_type TEXT DEFAULT 'Monthly',
      base_salary REAL DEFAULT 0,
      bonuses REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      net_salary REAL DEFAULT 0,
      payment_month TEXT,
      payment_date DATE,
      payment_method TEXT DEFAULT 'Bank Transfer',
      status TEXT DEFAULT 'Pending',
      slip_sent INTEGER DEFAULT 0,
      slip_sent_at DATETIME,
      notes TEXT,
      pdf_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS recurring_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      billing_cycle TEXT DEFAULT 'Monthly',
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT DEFAULT 'LKR',
      next_payment_date DATE,
      auto_renewal INTEGER DEFAULT 1,
      status TEXT DEFAULT 'Active',
      client_vendor TEXT,
      email TEXT,
      reminder_days INTEGER DEFAULT 3,
      last_reminder_sent DATE,
      last_processed_date DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      related_id INTEGER,
      related_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budget (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT UNIQUE NOT NULL,
      revenue_target REAL DEFAULT 0,
      expense_budget REAL DEFAULT 0,
      profit_goal REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_cache (
      id INTEGER PRIMARY KEY DEFAULT 1,
      insights TEXT,
      predictions TEXT,
      recommendations TEXT,
      summary TEXT,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO ai_cache (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY DEFAULT 1,
      base TEXT DEFAULT 'USD',
      rates_json TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO exchange_rates (id, base) VALUES (1, 'USD');

    CREATE TABLE IF NOT EXISTS client_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL UNIQUE,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_gateway_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      payhere_merchant_id TEXT DEFAULT '',
      payhere_secret TEXT DEFAULT '',
      payhere_mode TEXT DEFAULT 'sandbox',
      bank_account_no TEXT DEFAULT '102005870825',
      bank_account_name TEXT DEFAULT 'Groovymark (pvt) Ltd',
      bank_name TEXT DEFAULT 'DFCC Bank Gampaha',
      bank_swift TEXT DEFAULT 'DFCCLKLX',
      bank_branch TEXT DEFAULT 'Gampaha',
      enabled_gateways TEXT DEFAULT '["bank_transfer"]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO payment_gateway_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS payment_slips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      invoice_number TEXT,
      client_name TEXT,
      slip_path TEXT NOT NULL,
      amount REAL,
      currency TEXT DEFAULT 'LKR',
      reference TEXT,
      status TEXT DEFAULT 'Pending',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      admin_notes TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS online_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      invoice_number TEXT,
      gateway TEXT NOT NULL,
      gateway_order_id TEXT,
      gateway_payment_id TEXT,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'LKR',
      status TEXT DEFAULT 'Pending',
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS employee_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL UNIQUE,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employee_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      annual_total INTEGER DEFAULT 14,
      sick_total INTEGER DEFAULT 7,
      casual_total INTEGER DEFAULT 3,
      annual_used INTEGER DEFAULT 0,
      sick_used INTEGER DEFAULT 0,
      casual_used INTEGER DEFAULT 0,
      UNIQUE(employee_id, year),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employee_leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_name TEXT,
      leave_type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days_count INTEGER DEFAULT 1,
      reason TEXT,
      status TEXT DEFAULT 'Pending',
      admin_notes TEXT,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employee_kpi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_name TEXT,
      month TEXT NOT NULL,
      performance_score INTEGER DEFAULT 0,
      kpi_target INTEGER DEFAULT 80,
      tasks_completed INTEGER DEFAULT 0,
      attendance_pct INTEGER DEFAULT 100,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(employee_id, month),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- ── Project Management ─────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS project_types (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      client_id   INTEGER,
      client_name TEXT,
      start_date  DATE,
      status      TEXT DEFAULT 'active',
      type_ids    TEXT DEFAULT '[]',
      description TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id       INTEGER,
      title            TEXT NOT NULL,
      description      TEXT,
      assigned_to      INTEGER NOT NULL,
      assigned_name    TEXT,
      start_date       DATE,
      due_date         DATE,
      due_time         TEXT,
      submission_link  TEXT,
      priority         INTEGER DEFAULT 3,
      status           TEXT DEFAULT 'pending',
      timer_status     TEXT DEFAULT 'idle',
      timer_started_at DATETIME,
      total_seconds    INTEGER DEFAULT 0,
      completed_at     DATETIME,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (assigned_to) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS task_resources (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      name    TEXT NOT NULL,
      url     TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      title       TEXT NOT NULL,
      description TEXT,
      event_date  DATE NOT NULL,
      event_time  TEXT,
      color       TEXT DEFAULT 'blue',
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS employee_notices (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      message      TEXT NOT NULL,
      target       TEXT DEFAULT 'all',
      employee_ids TEXT DEFAULT '[]',
      is_active    INTEGER DEFAULT 1,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS birthday_wishes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      message     TEXT NOT NULL,
      sent_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      seen        INTEGER DEFAULT 0,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );
  `);

  // === Migrations: add columns to existing tables if not present ===
  const migrations = [
    `ALTER TABLE invoices ADD COLUMN currency TEXT DEFAULT 'LKR'`,
    `ALTER TABLE invoices ADD COLUMN currency_symbol TEXT DEFAULT 'Rs.'`,
    `ALTER TABLE invoices ADD COLUMN payment_methods TEXT DEFAULT 'bank'`,
    `ALTER TABLE revenue ADD COLUMN auto_recorded INTEGER DEFAULT 0`,
    `ALTER TABLE revenue ADD COLUMN recurring_payment_id INTEGER`,
    `ALTER TABLE expenses ADD COLUMN recurring_payment_id INTEGER`,
    `ALTER TABLE expenses ADD COLUMN salary_payment_id INTEGER`,
    `ALTER TABLE salary_payments ADD COLUMN currency TEXT DEFAULT 'LKR'`,
    `ALTER TABLE settings ADD COLUMN admin_username TEXT DEFAULT 'admin'`,
    `ALTER TABLE settings ADD COLUMN admin_password_hash TEXT`,
    `ALTER TABLE employees ADD COLUMN birthday DATE`,
  ];
  migrations.forEach(sql => {
    try { db.exec(sql); } catch (_) { /* column already exists */ }
  });

  const { runSaasMigrations } = require('./saasPhase1Migrate');
  runSaasMigrations(db);

  // Initialize default admin password if not set
  const bcrypt = require('bcryptjs');
  const adminSettings = db.prepare('SELECT admin_password_hash FROM settings WHERE id=1').get();
  if (!adminSettings?.admin_password_hash) {
    const hash = bcrypt.hashSync('Admin@2026', 10);
    db.prepare('UPDATE settings SET admin_username=?, admin_password_hash=? WHERE id=1').run('admin', hash);
  }

  console.log('✅ Database initialized');
}

initializeDatabase();
module.exports = db;
