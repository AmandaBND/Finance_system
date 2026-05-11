const db = require('../database');

const SUPPORTED_CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'INR', 'CAD', 'JPY'];

// Fallback rates (base USD) if API unreachable
const FALLBACK_RATES = {
  USD: 1, LKR: 299.50, EUR: 0.92, GBP: 0.79,
  AUD: 1.53, SGD: 1.34, INR: 83.45, CAD: 1.36, JPY: 149.80
};

async function fetchRatesFromAPI() {
  // Using open.er-api.com (free, no key, includes LKR)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal });
    const data = await res.json();
    if (data.result === 'success' && data.rates) {
      clearTimeout(timeout);
      return data.rates;
    }
    throw new Error('Invalid API response');
  } catch (err) {
    clearTimeout(timeout);
    // Fallback to second API
    try {
      const res2 = await fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: new AbortController().signal });
      const data2 = await res2.json();
      if (data2.rates) return data2.rates;
    } catch {}
    throw err;
  }
}

async function refreshRates() {
  try {
    const rates = await fetchRatesFromAPI();
    db.prepare('UPDATE exchange_rates SET rates_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=1').run(JSON.stringify(rates));
    console.log('✅ Exchange rates refreshed:', new Date().toLocaleTimeString());
    return rates;
  } catch (err) {
    console.error('⚠️  Rate refresh failed:', err.message, '(using cached/fallback rates)');
    const cached = getCachedRatesData();
    return cached ? cached.rates : FALLBACK_RATES;
  }
}

function getCachedRatesData() {
  try {
    const row = db.prepare('SELECT * FROM exchange_rates WHERE id=1').get();
    if (!row || !row.rates_json) return null;
    return { rates: JSON.parse(row.rates_json), updated_at: row.updated_at };
  } catch { return null; }
}

function getRates() {
  const cached = getCachedRatesData();
  return cached ? cached.rates : FALLBACK_RATES;
}

// Convert any currency amount to LKR
// Base is USD: rates.LKR = X means 1 USD = X LKR
// Formula: amountLKR = amount * (rates.LKR / rates[fromCurrency])
function convertToLKR(amount, fromCurrency, rates) {
  const amt = parseFloat(amount) || 0;
  if (amt === 0) return 0;
  const r = rates || getRates();
  const currency = (fromCurrency || 'LKR').toUpperCase();
  if (currency === 'LKR') return amt;
  const lkrRate = r.LKR || FALLBACK_RATES.LKR;
  const fromRate = r[currency] || 1;
  return amt * (lkrRate / fromRate);
}

// Convert LKR to any currency
function convertFromLKR(amountLKR, toCurrency, rates) {
  const amt = parseFloat(amountLKR) || 0;
  if (amt === 0) return 0;
  const r = rates || getRates();
  const currency = (toCurrency || 'LKR').toUpperCase();
  if (currency === 'LKR') return amt;
  const lkrRate = r.LKR || FALLBACK_RATES.LKR;
  const toRate = r[currency] || 1;
  return amt * (toRate / lkrRate);
}

// Get rate of 1 unit of currency in LKR
function getRateToLKR(currency, rates) {
  const r = rates || getRates();
  const c = (currency || 'LKR').toUpperCase();
  if (c === 'LKR') return 1;
  const lkrRate = r.LKR || FALLBACK_RATES.LKR;
  const fromRate = r[c] || 1;
  return lkrRate / fromRate;
}

// Summarize key rates for display
function getDisplayRates(rates) {
  const r = rates || getRates();
  const lkr = r.LKR || 299.50;
  return SUPPORTED_CURRENCIES.filter(c => c !== 'LKR').map(c => ({
    currency: c,
    rate_to_lkr: parseFloat((lkr / (r[c] || 1)).toFixed(2)),
    rate_from_lkr: parseFloat(((r[c] || 1) / lkr).toFixed(6))
  }));
}

// Sum records in LKR (each record has amount + currency field)
function sumToLKR(records, amountField = 'amount', currencyField = 'currency', rates) {
  const r = rates || getRates();
  return records.reduce((sum, rec) => {
    const amt = parseFloat(rec[amountField]) || 0;
    const cur = rec[currencyField] || 'LKR';
    return sum + convertToLKR(amt, cur, r);
  }, 0);
}

module.exports = {
  refreshRates, getCachedRatesData, getRates,
  convertToLKR, convertFromLKR, getRateToLKR,
  getDisplayRates, sumToLKR,
  SUPPORTED_CURRENCIES, FALLBACK_RATES
};
