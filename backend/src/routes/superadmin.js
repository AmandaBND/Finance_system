const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireSuperadmin, signSuperadminToken } = require('../middleware/superadminAuth');
const { SEED_COMPANY_ID } = require('../saasPhase1Migrate');
const { subMonths, format } = require('date-fns');
const { formatSriLankaTime } = require('../utils/timezoneHelper');

router.post('/login', (req, res) => {
  const email = (process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const pass = process.env.SUPERADMIN_PASSWORD || '';
  if (!email || !pass) {
    return res.status(503).json({ error: 'Super admin is not configured (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD)' });
  }
  const { email: e, password } = req.body;
  if (!e || !password) return res.status(400).json({ error: 'Email and password required' });
  if (String(e).trim().toLowerCase() !== email) return res.status(401).json({ error: 'Invalid credentials' });
  if (password !== pass) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signSuperadminToken();
  res.json({ token });
});

router.use(requireSuperadmin);

router.get('/stats', (req, res) => {
  try {
    const totalCompanies = db.prepare('SELECT COUNT(*) as c FROM companies').get().c;
    const since = format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    const active30 = db.prepare(`SELECT COUNT(DISTINCT company_id) as c FROM app_user_login_log WHERE created_at >= ?`).get(since).c;
    const byPlan = db.prepare(`SELECT plan, COUNT(*) as c FROM companies GROUP BY plan`).all();
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM app_users').get().c;
    const signupsMonth = db.prepare(`SELECT COUNT(*) as c FROM companies WHERE created_at >= ?`).get(since).c;
    res.json({ totalCompanies, activeCompanies30d: active30, byPlan, totalUsers, signupsThisMonth: signupsMonth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/companies', (req, res) => {
  try {
    const { q, plan, status } = req.query;
    let sql = `
      SELECT c.*,
        (SELECT COUNT(*) FROM app_users u WHERE u.company_id=c.id) as user_count,
        (SELECT MAX(created_at) FROM app_user_login_log l WHERE l.company_id=c.id) as last_login
      FROM companies c WHERE 1=1`;
    const params = [];
    if (q) {
      sql += ' AND (c.name LIKE ? OR c.email LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like);
    }
    if (plan) { sql += ' AND c.plan=?'; params.push(plan); }
    if (status) { sql += ' AND c.status=?'; params.push(status); }
    sql += ' ORDER BY c.created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/companies/:id', (req, res) => {
  try {
    const c = db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const users = db.prepare('SELECT id, email, name, role, last_login_at, created_at FROM app_users WHERE company_id=?').all(c.id);
    const invCount = db.prepare('SELECT COUNT(*) as c FROM invoices WHERE company_id=?').get(c.id).c;
    const cliCount = db.prepare('SELECT COUNT(*) as c FROM clients WHERE company_id=?').get(c.id).c;
    const empCount = db.prepare('SELECT COUNT(*) as c FROM employees WHERE company_id=?').get(c.id).c;
    const expCount = db.prepare('SELECT COUNT(*) as c FROM expenses WHERE company_id=?').get(c.id).c;
    const logins = db.prepare(`SELECT l.*, u.email FROM app_user_login_log l JOIN app_users u ON u.id=l.user_id WHERE l.company_id=? ORDER BY l.created_at DESC LIMIT 10`).all(c.id);
    const notes = db.prepare('SELECT * FROM superadmin_notes WHERE company_id=? ORDER BY created_at DESC').all(c.id);
    res.json({ company: c, users, stats: { invoices: invCount, clients: cliCount, employees: empCount, expenses: expCount }, logins, notes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/companies/:id', (req, res) => {
  try {
    const { plan, status } = req.body;
    if (plan) db.prepare('UPDATE companies SET plan=? WHERE id=?').run(String(plan).toLowerCase(), req.params.id);
    if (status) db.prepare('UPDATE companies SET status=? WHERE id=?').run(status, req.params.id);
    try {
      db.prepare(`INSERT INTO platform_events (company_id, event_type, message) VALUES (?,?,?)`).run(
        req.params.id, 'superadmin_edit', `Super admin updated company ${req.params.id}`
      );
    } catch (_) {}
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/companies/:id/notes', (req, res) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'note required' });
    db.prepare('INSERT INTO superadmin_notes (company_id, note) VALUES (?,?)').run(req.params.id, note);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/companies/:id/reset-owner-password', (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'new_password min 8 chars' });
    const company = db.prepare('SELECT owner_id FROM companies WHERE id=?').get(req.params.id);
    if (!company?.owner_id) return res.status(404).json({ error: 'No owner' });
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE app_users SET password_hash=? WHERE id=?').run(hash, company.owner_id);
    res.json({ ok: true, message: 'Owner password reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/activity', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM platform_events ORDER BY created_at DESC LIMIT 50`).all();
    // Format timestamps to Sri Lanka timezone
    const formatted = rows.map(row => ({
      ...row,
      created_at: formatSriLankaTime(row.created_at)
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
