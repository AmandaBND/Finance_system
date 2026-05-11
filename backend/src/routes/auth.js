const express = require('express');
const router = express.Router();
const db = require('../database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'groovymark-portal-jwt-2026-secure';

// Admin login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const settings = db.prepare('SELECT admin_username, admin_password_hash FROM settings WHERE id=1').get();
    if (!settings) return res.status(500).json({ error: 'System not configured' });

    if (username !== (settings.admin_username || 'admin')) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!settings.admin_password_hash) {
      return res.status(500).json({ error: 'Admin password not set. Restart the server.' });
    }
    const valid = await bcrypt.compare(password, settings.admin_password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign({ username, role: 'admin' }, SECRET, { expiresIn: '30d' });
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Change admin password
router.put('/change-password', async (req, res) => {
  const { current_password, new_password, new_username } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Fields required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const settings = db.prepare('SELECT admin_username, admin_password_hash FROM settings WHERE id=1').get();
    const valid = await bcrypt.compare(current_password, settings.admin_password_hash || '');
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    const usernameToSet = (new_username && new_username.trim()) ? new_username.trim() : settings.admin_username;
    db.prepare('UPDATE settings SET admin_username=?, admin_password_hash=? WHERE id=1').run(usernameToSet, hash);
    res.json({ message: 'Admin credentials updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
