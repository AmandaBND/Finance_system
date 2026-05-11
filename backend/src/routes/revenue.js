const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    const { status, search, from, to } = req.query;
    let query = 'SELECT * FROM revenue WHERE 1=1';
    const params = [];
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
    const { client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    const result = db.prepare(`
      INSERT INTO revenue (client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status || 'Pending', payment_method, is_recurring || 0, billing_cycle || 'One-time', notes, currency || 'LKR');
    res.json({ id: result.lastInsertRowid, message: 'Revenue entry added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    db.prepare(`
      UPDATE revenue SET client_name=?, project_name=?, service_type=?, invoice_number=?, invoice_date=?, due_date=?, amount=?, payment_status=?, payment_method=?, is_recurring=?, billing_cycle=?, notes=?, currency=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency || 'LKR', req.params.id);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM revenue WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', (req, res) => {
  try {
    const byClient = db.prepare(`SELECT client_name, SUM(amount) as total, COUNT(*) as count FROM revenue WHERE payment_status='Paid' GROUP BY client_name ORDER BY total DESC LIMIT 10`).all();
    const byService = db.prepare(`SELECT service_type, SUM(amount) as total FROM revenue WHERE payment_status='Paid' AND service_type IS NOT NULL GROUP BY service_type ORDER BY total DESC`).all();
    const byStatus = db.prepare(`SELECT payment_status, COUNT(*) as count, SUM(amount) as total FROM revenue GROUP BY payment_status`).all();
    res.json({ byClient, byService, byStatus });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
