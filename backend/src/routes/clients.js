const express = require('express');
const router = express.Router();
const db = require('../database');
const { enforceLimit } = require('../lib/enforceLimits');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM clients WHERE company_id=? ORDER BY name ASC').all(req.companyId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const cid = req.companyId;
    const plan = db.prepare('SELECT plan FROM companies WHERE id=?').get(cid)?.plan || 'free';
    const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients WHERE company_id=?').get(cid).c;
    enforceLimit(plan, 'clients', clientCount, 'Client');

    const { name, email, phone, company, address, country, notes } = req.body;
    const result = db.prepare(`INSERT INTO clients (name, email, phone, company, address, country, notes, company_id) VALUES (?,?,?,?,?,?,?,?)`).run(name, email, phone, company, address, country || 'Sri Lanka', notes, cid);
    res.json({ id: result.lastInsertRowid, message: 'Client added' });
  } catch (err) {
    if (err.code === 'PLAN_LIMIT_EXCEEDED') return res.status(403).json({ error: err.message, code: err.code, plan: err.plan, limit: err.limit, current: err.current });
    res.status(500).json({ error: err.message });
  }
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
