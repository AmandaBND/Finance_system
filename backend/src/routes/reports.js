const express = require('express');
const router = express.Router();
const db = require('../database');
const { format, startOfMonth, endOfMonth, startOfYear, endOfYear } = require('date-fns');

router.get('/pl', (req, res) => {
  try {
    const cid = req.companyId;
    const { month, year } = req.query;
    let startDate, endDate, period;
    if (month) {
      const d = new Date(month + '-01');
      startDate = format(startOfMonth(d), 'yyyy-MM-dd');
      endDate = format(endOfMonth(d), 'yyyy-MM-dd');
      period = format(d, 'MMMM yyyy');
    } else {
      const y = year || format(new Date(), 'yyyy');
      startDate = `${y}-01-01`;
      endDate = `${y}-12-31`;
      period = `Year ${y}`;
    }

    const revenue = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).get(cid, startDate, endDate);
    const expenses = db.prepare(`SELECT category, COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ? GROUP BY category`).all(cid, startDate, endDate);
    const totalExpenses = expenses.reduce((s, e) => s + e.total, 0);
    const netProfit = revenue.total - totalExpenses;
    const profitMargin = revenue.total > 0 ? ((netProfit / revenue.total) * 100).toFixed(1) : 0;

    res.json({ period, startDate, endDate, revenue: revenue.total, expenses, totalExpenses, netProfit, profitMargin: parseFloat(profitMargin) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/revenue', (req, res) => {
  try {
    const cid = req.companyId;
    const { from, to } = req.query;
    const start = from || format(startOfYear(new Date()), 'yyyy-MM-dd');
    const end = to || format(endOfYear(new Date()), 'yyyy-MM-dd');

    const byClient = db.prepare(`SELECT client_name, SUM(amount) as total, COUNT(*) as count FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ? GROUP BY client_name ORDER BY total DESC`).all(cid, start, end);
    const byService = db.prepare(`SELECT COALESCE(service_type,'Other') as service_type, SUM(amount) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ? GROUP BY service_type ORDER BY total DESC`).all(cid, start, end);
    const byMonth = db.prepare(`SELECT strftime('%Y-%m', invoice_date) as month, SUM(amount) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ? GROUP BY month ORDER BY month`).all(cid, start, end);
    const total = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).get(cid, start, end);

    res.json({ total: total.total, byClient, byService, byMonth, period: { from: start, to: end } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/expenses', (req, res) => {
  try {
    const cid = req.companyId;
    const { from, to } = req.query;
    const start = from || format(startOfYear(new Date()), 'yyyy-MM-dd');
    const end = to || format(endOfYear(new Date()), 'yyyy-MM-dd');

    const byCategory = db.prepare(`SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ? GROUP BY category ORDER BY total DESC`).all(cid, start, end);
    const byMonth = db.prepare(`SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ? GROUP BY month ORDER BY month`).all(cid, start, end);
    const total = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).get(cid, start, end);
    const items = db.prepare(`SELECT * FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ? ORDER BY payment_date DESC`).all(cid, start, end);

    res.json({ total: total.total, byCategory, byMonth, items, period: { from: start, to: end } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/payroll', (req, res) => {
  try {
    const cid = req.companyId;
    const { month } = req.query;
    const m = month || format(new Date(), 'yyyy-MM');
    const records = db.prepare(`SELECT * FROM salary_payments WHERE company_id=? AND payment_month=? ORDER BY employee_name`).all(cid, m);
    const totals = db.prepare(`SELECT SUM(base_salary) as total_base, SUM(bonuses) as total_bonuses, SUM(deductions) as total_deductions, SUM(net_salary) as total_net, COUNT(*) as count FROM salary_payments WHERE company_id=? AND payment_month=?`).get(cid, m);
    res.json({ month: m, records, totals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/cashflow', (req, res) => {
  try {
    const cid = req.companyId;
    const { year } = req.query;
    const y = year || format(new Date(), 'yyyy');
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${y}-${String(m).padStart(2, '0')}`;
      const start = `${monthStr}-01`;
      const daysInMonth = new Date(parseInt(y), m, 0).getDate();
      const end = `${monthStr}-${daysInMonth}`;
      const inflow = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).get(cid, start, end);
      const outflow = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).get(cid, start, end);
      months.push({
        month: monthStr,
        label: format(new Date(parseInt(y), m - 1, 1), 'MMM'),
        inflow: Math.round(inflow.total),
        outflow: Math.round(outflow.total),
        net: Math.round(inflow.total - outflow.total)
      });
    }
    res.json({ year: y, months });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
