const express = require('express');
const router = express.Router();
const db = require('../database');
const { generateInsights } = require('../services/aiService');

router.get('/insights', async (req, res) => {
  try {
    const companyId = req.companyId;
    const cache = db.prepare('SELECT * FROM ai_cache WHERE company_id=? LIMIT 1').get(companyId);
    if (cache?.generated_at) {
      const ageHours = (Date.now() - new Date(cache.generated_at).getTime()) / (1000 * 60 * 60);
      if (ageHours < 6 && cache.insights) {
        return res.json({
          insights: JSON.parse(cache.insights),
          predictions: JSON.parse(cache.predictions || '[]'),
          recommendations: JSON.parse(cache.recommendations || '[]'),
          summary: cache.summary,
          cached: true,
          generated_at: cache.generated_at
        });
      }
    }

    const result = await generateInsights(false, companyId);
    res.json({ ...result, cached: false });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const result = await generateInsights(true, req.companyId);
    res.json({ ...result, message: 'AI insights refreshed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
