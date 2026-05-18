const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { status, search, from, to } = req.query;
    let query = 'SELECT * FROM revenue WHERE company_id=?';
    const params = [cid];
    if (status) { query += ' AND payment_status=?'; params.push(status); }
    if (search) { query += ' AND (client_name LIKE ? OR project_name LIKE ? OR invoice_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (from) { query += ' AND invoice_date >= ?'; params.push(from); }
    if (to) { query += ' AND invoice_date <= ?'; params.push(to); }
    query += ' ORDER BY created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    const result = db.prepare(`
      INSERT INTO revenue (client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency, company_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status || 'Pending', payment_method, is_recurring || 0, billing_cycle || 'One-time', notes, currency || 'LKR', cid);
    res.json({ id: result.lastInsertRowid, message: 'Revenue entry added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const { client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    const r = db.prepare(`
      UPDATE revenue SET client_name=?, project_name=?, service_type=?, invoice_number=?, invoice_date=?, due_date=?, amount=?, payment_status=?, payment_method=?, is_recurring=?, billing_cycle=?, notes=?, currency=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND company_id=?
    `).run(client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency || 'LKR', req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM revenue WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', (req, res) => {
  try {
    const cid = req.companyId;
    const byClient = db.prepare(`SELECT client_name, SUM(amount) as total, COUNT(*) as count FROM revenue WHERE company_id=? AND payment_status='Paid' GROUP BY client_name ORDER BY total DESC LIMIT 10`).all(cid);
    const byService = db.prepare(`SELECT service_type, SUM(amount) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND service_type IS NOT NULL GROUP BY service_type ORDER BY total DESC`).all(cid);
    const byStatus = db.prepare(`SELECT payment_status, COUNT(*) as count, SUM(amount) as total FROM revenue WHERE company_id=? GROUP BY payment_status`).all(cid);
    res.json({ byClient, byService, byStatus });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
