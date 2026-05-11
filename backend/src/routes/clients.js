const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM clients ORDER BY name ASC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, email, phone, company, address, country, notes } = req.body;
    const result = db.prepare(`INSERT INTO clients (name, email, phone, company, address, country, notes) VALUES (?,?,?,?,?,?,?)`).run(name, email, phone, company, address, country || 'Sri Lanka', notes);
    res.json({ id: result.lastInsertRowid, message: 'Client added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, email, phone, company, address, country, notes } = req.body;
    db.prepare(`UPDATE clients SET name=?, email=?, phone=?, company=?, address=?, country=?, notes=? WHERE id=?`).run(name, email, phone, company, address, country, notes, req.params.id);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM clients WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
