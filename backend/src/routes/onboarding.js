const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireCompanyAuth } = require('../middleware/companyAuth');

const PLAN_VALUES = new Set(['free', 'professional', 'business', 'enterprise']);
const { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } = require('../services/currencyService');

router.post('/plan', requireCompanyAuth, (req, res) => {
  try {
    const raw = String(req.body.plan || 'free').toLowerCase();
    const plan = PLAN_VALUES.has(raw) ? raw : 'free';
    if (req.authType === 'legacy_admin') {
      db.prepare('UPDATE companies SET plan=? WHERE id=?').run(plan, req.companyId);
      return res.json({ ok: true, plan, needs_currency: false });
    }
    if (req.userRole !== 'owner') {
      return res.status(403).json({ error: 'Only the workspace owner can confirm the plan' });
    }
    db.prepare('UPDATE companies SET plan=? WHERE id=?').run(plan, req.companyId);
    const settings = db.prepare('SELECT currency_locked FROM settings WHERE company_id=? LIMIT 1').get(req.companyId);
    const needs_currency = !settings?.currency_locked;
    try {
      db.prepare(`INSERT INTO platform_events (company_id, actor_email, event_type, message) VALUES (?,?,?,?)`).run(
        req.companyId,
        req.authPayload?.email || '',
        'plan_selected',
        `Plan set to ${plan}`
      );
    } catch (_) {}
    res.json({ ok: true, plan, needs_currency });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/currency', requireCompanyAuth, (req, res) => {
  try {
    const currency = String(req.body.currency || '').toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      return res.status(400).json({ error: 'Please select a valid primary currency' });
    }
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    const existing = db.prepare('SELECT currency_locked, currency FROM settings WHERE company_id=? LIMIT 1').get(req.companyId);
    if (existing?.currency_locked) {
      return res.status(400).json({ error: 'Primary currency is already set and cannot be changed' });
    }
    db.prepare(`
      UPDATE settings SET currency=?, currency_symbol=?, currency_locked=1, updated_at=CURRENT_TIMESTAMP
      WHERE company_id=?
    `).run(currency, symbol, req.companyId);
    db.prepare('UPDATE companies SET first_login=0 WHERE id=?').run(req.companyId);
    try {
      db.prepare(`INSERT INTO platform_events (company_id, actor_email, event_type, message) VALUES (?,?,?,?)`).run(
        req.companyId,
        req.authPayload?.email || '',
        'currency_locked',
        `Primary currency set to ${currency}`
      );
    } catch (_) {}
    res.json({ ok: true, currency, currency_symbol: symbol });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
