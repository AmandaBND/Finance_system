const express = require('express');
const router = express.Router();
const { getRates, getCachedRatesData, refreshRates, getDisplayRates, convertToLKR, SUPPORTED_CURRENCIES } = require('../services/currencyService');

// Get current exchange rates
router.get('/rates', (req, res) => {
  try {
    const cached = getCachedRatesData();
    const rates = cached ? cached.rates : {};
    res.json({
      rates: getDisplayRates(rates),
      raw: rates,
      updated_at: cached?.updated_at,
      supported: SUPPORTED_CURRENCIES
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Force refresh rates from API
router.post('/refresh', async (req, res) => {
  try {
    const rates = await refreshRates();
    res.json({ message: 'Rates refreshed', rates: getDisplayRates(rates) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convert amount between currencies
router.get('/convert', (req, res) => {
  try {
    const { amount, from = 'USD', to = 'LKR' } = req.query;
    const rates = getRates();
    const fromTo = convertToLKR(parseFloat(amount), from, rates);
    if (to === 'LKR') return res.json({ result: Math.round(fromTo * 100) / 100, from, to, rate: fromTo / parseFloat(amount) });
    // from → LKR → to
    const lkr = rates.LKR || 300;
    const toRate = rates[to] || 1;
    const result = fromTo * (toRate / lkr);
    res.json({ result: Math.round(result * 100) / 100, from, to });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
