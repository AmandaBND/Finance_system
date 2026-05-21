const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireCompanyAuth } = require('../middleware/companyAuth');

const PLAN_VALUES = new Set(['free', 'professional', 'business', 'enterprise']);
const { getRates, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } = require('../services/currencyService');

router.post('/plan', requireCompanyAuth, (req, res) => {
  try {
    const raw = String(req.body.plan || 'free').toLowerCase();
    const plan = PLAN_VALUES.has(raw) ? raw : 'free';
    if (req.authType === 'legacy_admin') {
      const currency = (req.body.currency || '').toUpperCase();
      const chosenCurrency = SUPPORTED_CURRENCIES.includes(currency) ? currency : null;
      db.prepare('UPDATE companies SET plan=?, first_login=0 WHERE id=?').run(plan, req.companyId);
      if (chosenCurrency) {
        const s = db.prepare('SELECT currency FROM settings WHERE company_id=? LIMIT 1').get(req.companyId);
        if (!s || !s.currency) {
          const symbol = CURRENCY_SYMBOLS[chosenCurrency] || chosenCurrency;
          db.prepare('UPDATE settings SET currency=?, currency_symbol=? WHERE company_id=?').run(chosenCurrency, symbol, req.companyId);
        }
      }
      return res.json({ ok: true, plan });
    }
    if (req.userRole !== 'owner') {
      return res.status(403).json({ error: 'Only the workspace owner can confirm the plan' });
    }
    const currency = (req.body.currency || '').toUpperCase();
    const chosenCurrency = SUPPORTED_CURRENCIES.includes(currency) ? currency : null;
    db.prepare('UPDATE companies SET plan=?, first_login=0 WHERE id=?').run(plan, req.companyId);
    if (chosenCurrency) {
      const s = db.prepare('SELECT currency FROM settings WHERE company_id=? LIMIT 1').get(req.companyId);
      if (!s || !s.currency) {
        const symbol = CURRENCY_SYMBOLS[chosenCurrency] || chosenCurrency;
        db.prepare('UPDATE settings SET currency=?, currency_symbol=? WHERE company_id=?').run(chosenCurrency, symbol, req.companyId);
      }
    }
    try {
      db.prepare(`INSERT INTO platform_events (company_id, actor_email, event_type, message) VALUES (?,?,?,?)`).run(
        req.companyId,
        req.authPayload?.email || '',
        'plan_selected',
        `Plan set to ${plan}`
      );
    } catch (_) {}
    res.json({ ok: true, plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
