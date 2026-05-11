const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const clientAuth = require('../middleware/clientAuth');

const SECRET = process.env.JWT_SECRET || 'groovymark-portal-jwt-2026-secure';

// POST /api/portal/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const cred = db.prepare(`
      SELECT cc.*, c.name as client_name, c.email as client_email, c.company as client_company
      FROM client_credentials cc
      JOIN clients c ON c.id = cc.client_id
      WHERE cc.username = ?
    `).get(username);

    if (!cred) return res.status(401).json({ error: 'Invalid username or password' });
    if (!cred.is_active) return res.status(403).json({ error: 'Account is disabled. Please contact support.' });

    const valid = bcrypt.compareSync(password, cred.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    db.prepare(`UPDATE client_credentials SET last_login=CURRENT_TIMESTAMP WHERE id=?`).run(cred.id);

    const payload = {
      credId: cred.id,
      clientId: cred.client_id,
      username: cred.username,
      clientName: cred.client_name,
      clientEmail: cred.client_email,
      clientCompany: cred.client_company,
    };
    const token = jwt.sign(payload, SECRET, { expiresIn: '7d' });

    res.json({ token, client: payload });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/portal/me (protected)
router.get('/me', clientAuth, (req, res) => {
  try {
    const client = db.prepare(`SELECT c.*, cc.username, cc.is_active, cc.last_login FROM clients c JOIN client_credentials cc ON cc.client_id = c.id WHERE c.id = ?`).get(req.client.clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
