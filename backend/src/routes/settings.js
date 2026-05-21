const express = require('express');
const router = express.Router();
const db = require('../database');
const { validateAllowedCurrencies, normalizeCurrencyList, getAllowedCurrencies } = require('../lib/planLimits');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/logos'),
  filename: (req, file, cb) => cb(null, 'logo' + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function parseAllowedCurrencies(value, plan = 'free') {
  const parsed = normalizeCurrencyList(value)
  if (parsed.length) return parsed
  return getAllowedCurrencies(plan, [])
}

function getCompanyPlan(companyId) {
  return db.prepare('SELECT plan FROM companies WHERE id=?').get(companyId)?.plan || 'free'
}

router.get('/', (req, res) => {
  try {
    const plan = getCompanyPlan(req.companyId)
    const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(req.companyId);
    if (settings) {
      delete settings.smtp_pass;
      settings.plan = plan
      settings.allowed_currencies = parseAllowedCurrencies(settings.allowed_currencies, plan)
    }
    res.json(settings || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/full', (req, res) => {
  try {
    const plan = getCompanyPlan(req.companyId)
    const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(req.companyId) || {};
    if (settings) {
      settings.plan = plan
      settings.allowed_currencies = parseAllowedCurrencies(settings.allowed_currencies, plan)
    }
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/', (req, res) => {
  try {
    const cid = req.companyId;
    const plan = getCompanyPlan(cid)
    const fields = ['company_name', 'company_email', 'company_phone', 'company_address', 'company_website', 'currency', 'currency_symbol', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'openai_key', 'invoice_prefix', 'salary_prefix', 'invoice_terms', 'invoice_notes', 'auto_send_invoices', 'auto_send_reminders', 'reminder_days_before', 'overdue_check_enabled', 'allowed_currencies'];
    const updates = [];
    const values = [];

    if (req.body.allowed_currencies !== undefined) {
      const validation = validateAllowedCurrencies(plan, req.body.allowed_currencies)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }
      req.body.allowed_currencies = JSON.stringify(validation.allowed)
    }

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f}=?`);
        values.push(req.body[f]);
      }
    });
    if (updates.length) {
      updates.push('updated_at=CURRENT_TIMESTAMP');
      values.push(cid);
      const r = db.prepare(`UPDATE settings SET ${updates.join(',')} WHERE company_id=?`).run(...values);
      if (!r.changes) return res.status(404).json({ error: 'Settings row not found for company' });
    }
    res.json({ message: 'Settings saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logo_path = `/uploads/logos/${req.file.filename}`;
    const r = db.prepare('UPDATE settings SET logo_path=?, updated_at=CURRENT_TIMESTAMP WHERE company_id=?').run(logo_path, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Settings row not found' });
    res.json({ logo_path, message: 'Logo uploaded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/test-email', async (req, res) => {
  try {
    const { sendTestEmail } = require('../services/emailService');
    const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(req.companyId);
    await sendTestEmail(settings);
    res.json({ message: 'Test email sent successfully!' });
  } catch (err) {
    res.status(500).json({ error: `Email test failed: ${err.message}` });
  }
});

module.exports = router;
