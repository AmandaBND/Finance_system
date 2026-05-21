const db = require('../database');
const { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } = require('../services/currencyService');

function getCompanyPrimaryCurrency(companyId) {
  const s = db.prepare('SELECT currency, currency_symbol, currency_locked FROM settings WHERE company_id=? LIMIT 1').get(companyId) || {};
  const raw = (s.currency || 'USD').toUpperCase();
  const primary = SUPPORTED_CURRENCIES.includes(raw) ? raw : 'USD';
  return {
    primary,
    symbol: s.currency_symbol || CURRENCY_SYMBOLS[primary] || primary,
    locked: !!s.currency_locked,
  };
}

/**
 * Resolves the value used for reports/totals in primary currency.
 * Same currency as primary → use transaction amount.
 * Foreign currency → require manual amount_primary from client.
 */
function resolveAmountPrimary({ companyId, currency, amount, amount_primary }) {
  const { primary } = getCompanyPrimaryCurrency(companyId);
  const cur = (currency || primary).toUpperCase();
  const amt = parseFloat(amount) || 0;
  if (cur === primary) return amt;
  const ap = parseFloat(amount_primary);
  if (!Number.isFinite(ap) || ap < 0) {
    const err = new Error(`Enter the amount converted to your primary currency (${primary})`);
    err.status = 400;
    throw err;
  }
  return ap;
}

module.exports = { getCompanyPrimaryCurrency, resolveAmountPrimary };
