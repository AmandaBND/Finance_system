const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM employees ORDER BY name ASC').all());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { name, position, department, email, phone, salary_type, base_salary, start_date, birthday, notes } = req.body;
    const result = db.prepare(`INSERT INTO employees (name, position, department, email, phone, salary_type, base_salary, start_date, birthday, notes) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(name, position, department, email, phone, salary_type || 'Monthly', base_salary || 0, start_date, birthday || null, notes);
    res.json({ id: result.lastInsertRowid, message: 'Employee added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { name, position, department, email, phone, salary_type, base_salary, start_date, birthday, status, notes } = req.body;
    db.prepare(`UPDATE employees SET name=?, position=?, department=?, email=?, phone=?, salary_type=?, base_salary=?, start_date=?, birthday=?, status=?, notes=? WHERE id=?`).run(name, position, department, email, phone, salary_type, base_salary, start_date, birthday || null, status || 'Active', notes, req.params.id);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM employees WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
