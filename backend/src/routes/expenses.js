const express = require('express');
const router = express.Router();
const db = require('../database');
const { enforceLimit } = require('../lib/enforceLimits');
const { isCurrencyAllowed, normalizeCurrencyList, getAllowedCurrencies } = require('../lib/planLimits');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/receipts'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

function getAllowedCompanyCurrencies(cid, plan) {
  const row = db.prepare('SELECT allowed_currencies FROM settings WHERE company_id=? LIMIT 1').get(cid) || {};
  const selected = normalizeCurrencyList(row.allowed_currencies);
  if (plan === 'enterprise') return selected.length ? selected : [];
  return getAllowedCurrencies(plan, selected);
}

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { category, search, from, to } = req.query;
    let query = 'SELECT * FROM expenses WHERE company_id=?';
    const params = [cid];
    if (category) { query += ' AND category=?'; params.push(category); }
    if (search) { query += ' AND (title LIKE ? OR vendor LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (from) { query += ' AND payment_date >= ?'; params.push(from); }
    if (to) { query += ' AND payment_date <= ?'; params.push(to); }
    query += ' ORDER BY payment_date DESC, created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', upload.single('receipt'), (req, res) => {
  try {
    const cid = req.companyId;
    const plan = db.prepare('SELECT plan FROM companies WHERE id=?').get(cid)?.plan || 'free';
    const expenseCount = db.prepare(`SELECT COUNT(*) as c FROM expenses WHERE company_id=? AND created_at >= datetime('now','start of month') AND created_at < datetime('now','start of month','+1 month')`).get(cid).c;
    enforceLimit(plan, 'expensesPerMonth', expenseCount, 'Expense');

    const { title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    const allowedCurrencies = getAllowedCompanyCurrencies(cid, plan);
    if (!isCurrencyAllowed(plan, currency || 'LKR', allowedCurrencies)) {
      return res.status(400).json({ error: `Currency ${currency || 'LKR'} is not allowed for your plan`, allowedCurrencies });
    }

    const receipt_path = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const result = db.prepare(`
      INSERT INTO expenses (title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, receipt_path, notes, currency, company_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(title, category, vendor, amount, payment_date, payment_method, is_recurring || 0, billing_cycle, receipt_path, notes, currency || 'LKR', cid);
    res.json({ id: result.lastInsertRowid, message: 'Expense added' });
  } catch (err) {
    if (err.code === 'PLAN_LIMIT_EXCEEDED') return res.status(403).json({ error: err.message, code: err.code, plan: err.plan, limit: err.limit, current: err.current });
    res.status(500).json({ error: err.message }); }
});

router.put('/:id', upload.single('receipt'), (req, res) => {
  try {
    const cid = req.companyId;
    const plan = db.prepare('SELECT plan FROM companies WHERE id=?').get(cid)?.plan || 'free';
    const { title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    const existing = db.prepare('SELECT * FROM expenses WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const allowedCurrencies = getAllowedCompanyCurrencies(cid, plan);
    if (!isCurrencyAllowed(plan, currency || existing.currency || 'LKR', allowedCurrencies)) {
      return res.status(400).json({ error: `Currency ${currency || existing.currency || 'LKR'} is not allowed for your plan`, allowedCurrencies });
    }
    const receipt_path = req.file ? `/uploads/receipts/${req.file.filename}` : existing.receipt_path;
    db.prepare(`
      UPDATE expenses SET title=?, category=?, vendor=?, amount=?, payment_date=?, payment_method=?, is_recurring=?, billing_cycle=?, receipt_path=?, notes=?, currency=?
      WHERE id=? AND company_id=?
    `).run(title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, receipt_path, notes, currency || existing.currency || 'LKR', req.params.id, cid);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM expenses WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/categories', (req, res) => {
  try {
    const cats = db.prepare('SELECT DISTINCT category FROM expenses WHERE company_id=? ORDER BY category').all(req.companyId).map(r => r.category);
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
