const express = require('express');
const router = express.Router();
const db = require('../database');
const { format, addMonths, addYears, addDays } = require('date-fns');

router.get('/', (req, res) => {
  try {
    const { type, status } = req.query;
    let query = 'SELECT * FROM recurring_payments WHERE 1=1';
    const params = [];
    if (type) { query += ' AND type=?'; params.push(type); }
    if (status) { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY next_payment_date ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, type, category, billing_cycle, amount, currency, next_payment_date, auto_renewal, client_vendor, email, reminder_days, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO recurring_payments (name, type, category, billing_cycle, amount, currency, next_payment_date, auto_renewal, client_vendor, email, reminder_days, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(name, type, category, billing_cycle || 'Monthly', amount, currency || 'LKR', next_payment_date, auto_renewal !== false ? 1 : 0, client_vendor, email, reminder_days || 3, notes);
    res.json({ id: result.lastInsertRowid, message: 'Recurring payment added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, type, category, billing_cycle, amount, currency, next_payment_date, auto_renewal, status, client_vendor, email, reminder_days, notes } = req.body;
    db.prepare(`
      UPDATE recurring_payments SET name=?, type=?, category=?, billing_cycle=?, amount=?, currency=?, next_payment_date=?, auto_renewal=?, status=?, client_vendor=?, email=?, reminder_days=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, type, category, billing_cycle, amount, currency || 'LKR', next_payment_date, auto_renewal ? 1 : 0, status || 'Active', client_vendor, email, reminder_days || 3, notes, req.params.id);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const rp = db.prepare('SELECT * FROM recurring_payments WHERE id=?').get(req.params.id);
    if (rp) {
      // Delete linked expenses and revenue records
      db.prepare('DELETE FROM expenses WHERE recurring_payment_id=?').run(rp.id);
      db.prepare('DELETE FROM revenue WHERE recurring_payment_id=?').run(rp.id);
    }
    db.prepare('DELETE FROM recurring_payments WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Process/advance a recurring payment (mark as processed & advance date)
router.post('/:id/process', (req, res) => {
  try {
    const rp = db.prepare('SELECT * FROM recurring_payments WHERE id=?').get(req.params.id);
    if (!rp) return res.status(404).json({ error: 'Not found' });
    
    let nextDate = new Date(rp.next_payment_date);
    if (rp.billing_cycle === 'Monthly') nextDate = addMonths(nextDate, 1);
    else if (rp.billing_cycle === 'Quarterly') nextDate = addMonths(nextDate, 3);
    else if (rp.billing_cycle === 'Annual') nextDate = addYears(nextDate, 1);
    else if (rp.billing_cycle === 'Weekly') nextDate = addDays(nextDate, 7);
    
    const paidDate = format(new Date(), 'yyyy-MM-dd');
    
    // If type is Expense, create an expense record
    if (rp.type === 'Expense') {
      db.prepare(`
        INSERT INTO expenses (title, category, vendor, amount, payment_date, payment_method, currency, recurring_payment_id, notes)
        VALUES (?, ?, ?, ?, ?, 'Auto-recurring', ?, ?, ?)
      `).run(
        rp.name,
        rp.category || 'Recurring',
        rp.client_vendor,
        rp.amount,
        paidDate,
        rp.currency || 'LKR',
        rp.id,
        `Auto-recorded from recurring payment #${rp.id}`
      );
    } else if (rp.type === 'Income') {
      // If type is Income, create a revenue record
      db.prepare(`
        INSERT INTO revenue (client_name, project_name, service_type, amount, invoice_date, payment_status, currency, recurring_payment_id, is_recurring, billing_cycle, notes, auto_recorded)
        VALUES (?, ?, ?, ?, ?, 'Paid', ?, ?, 1, ?, ?, 1)
      `).run(
        rp.client_vendor,
        rp.name,
        rp.category,
        rp.amount,
        paidDate,
        rp.currency || 'LKR',
        rp.id,
        rp.billing_cycle || 'Monthly',
        `Auto-recorded from recurring payment #${rp.id}`
      );
    }
    
    db.prepare(`UPDATE recurring_payments SET last_processed_date=date('now'), next_payment_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(format(nextDate, 'yyyy-MM-dd'), rp.id);
    res.json({ message: 'Processed', next_payment_date: format(nextDate, 'yyyy-MM-dd') });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
