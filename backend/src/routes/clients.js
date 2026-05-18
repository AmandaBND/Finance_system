const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM clients WHERE company_id=? ORDER BY name ASC').all(req.companyId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, email, phone, company, address, country, notes } = req.body;
    const result = db.prepare(`INSERT INTO clients (name, email, phone, company, address, country, notes, company_id) VALUES (?,?,?,?,?,?,?,?)`).run(name, email, phone, company, address, country || 'Sri Lanka', notes, req.companyId);
    res.json({ id: result.lastInsertRowid, message: 'Client added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, email, phone, company, address, country, notes } = req.body;
    const r = db.prepare(`UPDATE clients SET name=?, email=?, phone=?, company=?, address=?, country=?, notes=? WHERE id=? AND company_id=?`).run(name, email, phone, company, address, country, notes, req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM clients WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
