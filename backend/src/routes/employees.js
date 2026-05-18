const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM employees WHERE company_id=? ORDER BY name ASC').all(req.companyId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, position, department, email, phone, salary_type, base_salary, start_date, birthday, notes } = req.body;
    const result = db.prepare(`INSERT INTO employees (name, position, department, email, phone, salary_type, base_salary, start_date, birthday, notes, company_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(name, position, department, email, phone, salary_type || 'Monthly', base_salary || 0, start_date, birthday || null, notes, req.companyId);
    res.json({ id: result.lastInsertRowid, message: 'Employee added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, position, department, email, phone, salary_type, base_salary, start_date, birthday, status, notes } = req.body;
    const r = db.prepare(`UPDATE employees SET name=?, position=?, department=?, email=?, phone=?, salary_type=?, base_salary=?, start_date=?, birthday=?, status=?, notes=? WHERE id=? AND company_id=?`).run(name, position, department, email, phone, salary_type, base_salary, start_date, birthday || null, status || 'Active', notes, req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM employees WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
