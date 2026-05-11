const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const employeeAuth = require('../middleware/employeeAuth');

const SECRET = process.env.JWT_SECRET || 'groovymark-portal-jwt-2026-secure';

// POST /api/employee/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const cred = db.prepare(`
      SELECT ec.*, e.name as employee_name, e.email as employee_email, e.position as employee_position, e.department
      FROM employee_credentials ec
      JOIN employees e ON e.id = ec.employee_id
      WHERE ec.username = ? AND ec.is_active = 1
    `).get(username);

    if (!cred) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, cred.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    db.prepare(`UPDATE employee_credentials SET last_login = CURRENT_TIMESTAMP WHERE id = ?`).run(cred.id);

    const payload = {
      credId: cred.id,
      employeeId: cred.employee_id,
      username: cred.username,
      employeeName: cred.employee_name,
      employeeEmail: cred.employee_email,
      employeePosition: cred.employee_position,
      department: cred.department,
    };

    const token = jwt.sign(payload, SECRET, { expiresIn: '7d' });

    res.json({
      token,
      employee: payload,
    });
  } catch (err) {
    console.error('Employee login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employee/me (protected)
router.get('/me', employeeAuth, (req, res) => {
  const emp = db.prepare(`
    SELECT e.*, ec.username, ec.last_login, ec.is_active
    FROM employees e
    JOIN employee_credentials ec ON ec.employee_id = e.id
    WHERE e.id = ?
  `).get(req.employee.employeeId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  res.json(emp);
});

module.exports = router;
