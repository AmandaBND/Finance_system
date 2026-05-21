const express = require('express');
const router = express.Router();
const db = require('../database');
const { format, addMonths, addYears, addDays } = require('date-fns');
const { isCurrencyAllowed, normalizeCurrencyList, getAllowedCurrencies } = require('../lib/planLimits');

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { type, status } = req.query;
    let query = 'SELECT * FROM recurring_payments WHERE company_id=?';
    const params = [cid];
    if (type) { query += ' AND type=?'; params.push(type); }
    if (status) { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY next_payment_date ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function getAllowedCompanyCurrencies(cid, plan) {
  const row = db.prepare('SELECT allowed_currencies FROM settings WHERE company_id=? LIMIT 1').get(cid) || {};
  const selected = normalizeCurrencyList(row.allowed_currencies);
  if (plan === 'enterprise') return selected.length ? selected : [];
  return getAllowedCurrencies(plan, selected);
}

router.post('/', (req, res) => {
  try {
    const cid = req.companyId;
    const plan = db.prepare('SELECT plan FROM companies WHERE id=?').get(cid)?.plan || 'free';
    const { name, type, category, billing_cycle, amount, currency, next_payment_date, auto_renewal, client_vendor, email, reminder_days, notes } = req.body;
    const allowedCurrencies = getAllowedCompanyCurrencies(cid, plan);
    if (!isCurrencyAllowed(plan, currency || 'LKR', allowedCurrencies)) {
      return res.status(400).json({ error: `Currency ${currency || 'LKR'} is not allowed for your plan`, allowedCurrencies });
    }
    const result = db.prepare(`
      INSERT INTO recurring_payments (name, type, category, billing_cycle, amount, currency, next_payment_date, auto_renewal, client_vendor, email, reminder_days, notes, company_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(name, type, category, billing_cycle || 'Monthly', amount, currency || 'LKR', next_payment_date, auto_renewal !== false ? 1 : 0, client_vendor, email, reminder_days || 3, notes, cid);
    res.json({ id: result.lastInsertRowid, message: 'Recurring payment added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const plan = db.prepare('SELECT plan FROM companies WHERE id=?').get(cid)?.plan || 'free';
    const { name, type, category, billing_cycle, amount, currency, next_payment_date, auto_renewal, status, client_vendor, email, reminder_days, notes } = req.body;
    const allowedCurrencies = getAllowedCompanyCurrencies(cid, plan);
    if (!isCurrencyAllowed(plan, currency || 'LKR', allowedCurrencies)) {
      return res.status(400).json({ error: `Currency ${currency || 'LKR'} is not allowed for your plan`, allowedCurrencies });
    }
    const r = db.prepare(`
      UPDATE recurring_payments SET name=?, type=?, category=?, billing_cycle=?, amount=?, currency=?, next_payment_date=?, auto_renewal=?, status=?, client_vendor=?, email=?, reminder_days=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND company_id=?
    `).run(name, type, category, billing_cycle, amount, currency || 'LKR', next_payment_date, auto_renewal ? 1 : 0, status || 'Active', client_vendor, email, reminder_days || 3, notes, req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const rp = db.prepare('SELECT * FROM recurring_payments WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (rp) {
      db.prepare('DELETE FROM expenses WHERE recurring_payment_id=? AND company_id=?').run(rp.id, cid);
      db.prepare('DELETE FROM revenue WHERE recurring_payment_id=? AND company_id=?').run(rp.id, cid);
    }
    const r = db.prepare('DELETE FROM recurring_payments WHERE id=? AND company_id=?').run(req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/process', (req, res) => {
  try {
    const cid = req.companyId;
    const rp = db.prepare('SELECT * FROM recurring_payments WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!rp) return res.status(404).json({ error: 'Not found' });

    let nextDate = new Date(rp.next_payment_date);
    if (rp.billing_cycle === 'Monthly') nextDate = addMonths(nextDate, 1);
    else if (rp.billing_cycle === 'Quarterly') nextDate = addMonths(nextDate, 3);
    else if (rp.billing_cycle === 'Annual') nextDate = addYears(nextDate, 1);
    else if (rp.billing_cycle === 'Weekly') nextDate = addDays(nextDate, 7);

    const paidDate = format(new Date(), 'yyyy-MM-dd');

    if (rp.type === 'Expense') {
      db.prepare(`
        INSERT INTO expenses (title, category, vendor, amount, payment_date, payment_method, currency, recurring_payment_id, notes, company_id)
        VALUES (?, ?, ?, ?, ?, 'Auto-recurring', ?, ?, ?, ?)
      `).run(
        rp.name,
        rp.category || 'Recurring',
        rp.client_vendor,
        rp.amount,
        paidDate,
        rp.currency || 'LKR',
        rp.id,
        `Auto-recorded from recurring payment #${rp.id}`,
        cid
      );
    } else if (rp.type === 'Income') {
      db.prepare(`
        INSERT INTO revenue (client_name, project_name, service_type, amount, invoice_date, payment_status, currency, recurring_payment_id, is_recurring, billing_cycle, notes, auto_recorded, company_id)
        VALUES (?, ?, ?, ?, ?, 'Paid', ?, ?, 1, ?, ?, 1, ?)
      `).run(
        rp.client_vendor,
        rp.name,
        rp.category,
        rp.amount,
        paidDate,
        rp.currency || 'LKR',
        rp.id,
        rp.billing_cycle || 'Monthly',
        `Auto-recorded from recurring payment #${rp.id}`,
        cid
      );
    }

    db.prepare(`UPDATE recurring_payments SET last_processed_date=date('now'), next_payment_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`).run(format(nextDate, 'yyyy-MM-dd'), rp.id, cid);
    res.json({ message: 'Processed', next_payment_date: format(nextDate, 'yyyy-MM-dd') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
