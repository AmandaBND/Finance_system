const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/logos'),
  filename: (req, file, cb) => cb(null, 'logo' + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    if (settings) delete settings.smtp_pass; // Don't expose password
    res.json(settings || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/full', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM settings WHERE id=1').get() || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/', (req, res) => {
  try {
    const fields = ['company_name', 'company_email', 'company_phone', 'company_address', 'company_website', 'currency', 'currency_symbol', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'openai_key', 'invoice_prefix', 'salary_prefix', 'invoice_terms', 'invoice_notes', 'auto_send_invoices', 'auto_send_reminders', 'reminder_days_before', 'overdue_check_enabled'];
    const updates = [];
    const values = [];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f}=?`);
        values.push(req.body[f]);
      }
    });
    if (updates.length) {
      updates.push('updated_at=CURRENT_TIMESTAMP');
      values.push(1);
      db.prepare(`UPDATE settings SET ${updates.join(',')} WHERE id=?`).run(...values);
    }
    res.json({ message: 'Settings saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logo_path = `/uploads/logos/${req.file.filename}`;
    db.prepare('UPDATE settings SET logo_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=1').run(logo_path);
    res.json({ logo_path, message: 'Logo uploaded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Test email connection
router.post('/test-email', async (req, res) => {
  try {
    const { sendTestEmail } = require('../services/emailService');
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    await sendTestEmail(settings);
    res.json({ message: 'Test email sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: `Email test failed: ${err.message}` });
  }
});

module.exports = router;
