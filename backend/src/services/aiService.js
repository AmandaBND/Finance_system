const OpenAI = require('openai');
const db = require('../database');
const { format, subMonths, startOfMonth, endOfMonth } = require('date-fns');

function getClient(companyId) {
  const settings = companyId
    ? db.prepare('SELECT openai_key FROM settings WHERE company_id=? LIMIT 1').get(companyId)
    : db.prepare('SELECT openai_key FROM settings WHERE id=1').get();
  const key = settings?.openai_key || process.env.OPENAI_API_KEY;
  return new OpenAI({ apiKey: key });
}

function gatherFinancialData(companyId) {
  const now = new Date();
  const data = {};
  const cid = companyId;

  data.revenueHistory = [];
  for (let i = 2; i >= 0; i--) {
    const d = subMonths(now, i);
    const start = format(startOfMonth(d), 'yyyy-MM-dd');
    const end = format(endOfMonth(d), 'yyyy-MM-dd');
    const rev = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).get(cid, start, end);
    const exp = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).get(cid, start, end);
    const sal = db.prepare(`SELECT COALESCE(SUM(net_salary),0) as total FROM salary_payments WHERE company_id=? AND status='Paid' AND payment_month=?`).get(cid, format(d, 'yyyy-MM'));
    data.revenueHistory.push({ month: format(d, 'MMM yyyy'), revenue: Math.round(rev.total), expenses: Math.round(exp.total), salaries: Math.round(sal.total) });
  }

  const mStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const mEnd = format(endOfMonth(now), 'yyyy-MM-dd');
  const curRev = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).get(cid, mStart, mEnd);
  const curExp = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).get(cid, mStart, mEnd);
  data.currentMonthRevenue = Math.round(curRev.total);
  data.currentMonthExpenses = Math.round(curExp.total);

  const overdueCount = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as t FROM invoices WHERE company_id=? AND status='Overdue'`).get(cid);
  const pendingCount = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(total),0) as t FROM invoices WHERE company_id=? AND status='Sent'`).get(cid);
  data.overdueInvoices = { count: overdueCount.c, amount: Math.round(overdueCount.t) };
  data.pendingInvoices = { count: pendingCount.c, amount: Math.round(pendingCount.t) };

  data.expenseBreakdown = db.prepare(`SELECT category, SUM(amount) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC LIMIT 5`).all(cid, mStart, mEnd);

  data.upcomingPayments = db.prepare(`SELECT name, type, amount, next_payment_date FROM recurring_payments WHERE company_id=? AND status='Active' AND next_payment_date BETWEEN date('now') AND date('now', '+30 days') ORDER BY next_payment_date LIMIT 10`).all(cid);

  data.pendingSalaries = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(net_salary),0) as t FROM salary_payments WHERE company_id=? AND status='Pending'`).get(cid);

  const yearStart = `${format(now, 'yyyy')}-01-01`;
  const yearEnd = format(now, 'yyyy-MM-dd');
  const ytdRev = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).get(cid, yearStart, yearEnd);
  const ytdExp = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).get(cid, yearStart, yearEnd);
  data.ytdRevenue = Math.round(ytdRev.total);
  data.ytdExpenses = Math.round(ytdExp.total);

  return data;
}

async function generateInsights(forceRefresh = false, companyId) {
  if (!companyId) throw new Error('companyId required');
  const data = gatherFinancialData(companyId);
  const client = getClient(companyId);

  const cache = db.prepare('SELECT * FROM ai_cache WHERE company_id=? LIMIT 1').get(companyId);
  if (!forceRefresh && cache?.generated_at) {
    const ageHours = (Date.now() - new Date(cache.generated_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < 6 && cache.insights) {
      return {
        insights: JSON.parse(cache.insights),
        predictions: JSON.parse(cache.predictions || '[]'),
        recommendations: JSON.parse(cache.recommendations || '[]'),
        summary: cache.summary,
        cached: true,
        generated_at: cache.generated_at
      };
    }
  }

  const prompt = `You are a professional financial analyst AI.

Analyze this financial data and provide actionable insights:

${JSON.stringify(data, null, 2)}

Respond with a JSON object with exactly these fields:
{
  "summary": "2-sentence executive summary of financial health",
  "insights": [
    {"type": "positive|warning|critical|info", "title": "Short title", "detail": "1-2 sentences"}
  ],
  "predictions": [
    {"metric": "metric name", "prediction": "what to expect", "confidence": "high|medium|low"}
  ],
  "recommendations": [
    {"priority": "high|medium|low", "action": "Specific actionable recommendation", "impact": "Expected impact"}
  ]
}

Provide 4-5 insights, 3 predictions, and 3-4 recommendations. Be specific with numbers. Use LKR currency.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content);

    const existing = db.prepare('SELECT id FROM ai_cache WHERE company_id=?').get(companyId);
    if (existing) {
      db.prepare(`UPDATE ai_cache SET insights=?, predictions=?, recommendations=?, summary=?, generated_at=CURRENT_TIMESTAMP WHERE company_id=?`).run(
        JSON.stringify(result.insights || []),
        JSON.stringify(result.predictions || []),
        JSON.stringify(result.recommendations || []),
        result.summary || '',
        companyId
      );
    } else {
      db.prepare(`INSERT INTO ai_cache (insights, predictions, recommendations, summary, company_id) VALUES (?,?,?,?,?)`).run(
        JSON.stringify(result.insights || []),
        JSON.stringify(result.predictions || []),
        JSON.stringify(result.recommendations || []),
        result.summary || '',
        companyId
      );
    }

    return { ...result, cached: false };
  } catch (err) {
    console.error('AI service error:', err);
    return {
      summary: 'AI insights unavailable. Please check your OpenAI API key in settings.',
      insights: [{ type: 'info', title: 'AI Unavailable', detail: 'Configure your OpenAI API key in Settings to enable AI insights.' }],
      predictions: [],
      recommendations: []
    };
  }
}

module.exports = { generateInsights, gatherFinancialData };
