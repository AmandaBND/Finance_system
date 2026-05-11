const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/receipts'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.get('/', (req, res) => {
  try {
    const { category, search, from, to } = req.query;
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
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
    const { title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    const receipt_path = req.file ? `/uploads/receipts/${req.file.filename}` : null;
    const result = db.prepare(`
      INSERT INTO expenses (title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, receipt_path, notes, currency)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(title, category, vendor, amount, payment_date, payment_method, is_recurring || 0, billing_cycle, receipt_path, notes, currency || 'LKR');
    res.json({ id: result.lastInsertRowid, message: 'Expense added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', upload.single('receipt'), (req, res) => {
  try {
    const { title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, notes, currency } = req.body;
    const existing = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
    const receipt_path = req.file ? `/uploads/receipts/${req.file.filename}` : existing?.receipt_path;
    db.prepare(`
      UPDATE expenses SET title=?, category=?, vendor=?, amount=?, payment_date=?, payment_method=?, is_recurring=?, billing_cycle=?, receipt_path=?, notes=?, currency=?
      WHERE id=?
    `).run(title, category, vendor, amount, payment_date, payment_method, is_recurring, billing_cycle, receipt_path, notes, currency || 'LKR', req.params.id);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/categories', (req, res) => {
  try {
    const cats = db.prepare('SELECT DISTINCT category FROM expenses ORDER BY category').all().map(r => r.category);
    res.json(cats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
