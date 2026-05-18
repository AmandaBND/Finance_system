const express = require('express');
const router = express.Router();
const db = require('../database');
const { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } = require('date-fns');
const { getRates, convertToLKR, getDisplayRates, sumToLKR } = require('../services/currencyService');
const { syncOverdueInvoices } = require('../services/invoiceOverdueSync');

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    syncOverdueInvoices(cid);
    const now = new Date();
    const rates = getRates();
    const rateInfo = getDisplayRates(rates);

    const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const thisMonthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');
    const thisYearStart  = format(startOfYear(now),  'yyyy-MM-dd');
    const thisYearEnd    = format(endOfYear(now),     'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const lastMonthEnd   = format(endOfMonth(subMonths(now, 1)),   'yyyy-MM-dd');

    const monthRevRecords = db.prepare(`SELECT amount, currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, thisMonthStart, thisMonthEnd);
    const yearRevRecords  = db.prepare(`SELECT amount, currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, thisYearStart, thisYearEnd);
    const lastMonthRevR   = db.prepare(`SELECT amount, currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, lastMonthStart, lastMonthEnd);

    const monthRevenue   = Math.round(sumToLKR(monthRevRecords, 'amount', 'currency', rates));
    const yearRevenue    = Math.round(sumToLKR(yearRevRecords,  'amount', 'currency', rates));
    const lastMonthRev   = Math.round(sumToLKR(lastMonthRevR,   'amount', 'currency', rates));

    const monthExpRecords = db.prepare(`SELECT amount, currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, thisMonthStart, thisMonthEnd);
    const yearExpRecords  = db.prepare(`SELECT amount, currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, thisYearStart, thisYearEnd);
    const lastMonthExpR   = db.prepare(`SELECT amount, currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, lastMonthStart, lastMonthEnd);

    const monthExpenses  = Math.round(sumToLKR(monthExpRecords, 'amount', 'currency', rates));
    const yearExpenses   = Math.round(sumToLKR(yearExpRecords,  'amount', 'currency', rates));
    const lastMonthExp   = Math.round(sumToLKR(lastMonthExpR,   'amount', 'currency', rates));

    const monthSalR = db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Paid' AND payment_month=?`).all(cid, format(now, 'yyyy-MM'));
    const monthSalaries = Math.round(sumToLKR(monthSalR, 'net_salary', 'currency', rates));

    const yearSalR = db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Paid' AND payment_month LIKE ?`).all(cid, format(now, 'yyyy') + '-%');
    const yearSalaries = Math.round(sumToLKR(yearSalR, 'net_salary', 'currency', rates));

    const lastMonthSalR = db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Paid' AND payment_month=?`).all(cid, format(subMonths(now, 1), 'yyyy-MM'));
    const lastMonthSalaries = Math.round(sumToLKR(lastMonthSalR, 'net_salary', 'currency', rates));

    const pendingInvR  = db.prepare(`SELECT total, COALESCE(currency,'LKR') as currency FROM invoices WHERE company_id=? AND status='Sent'`).all(cid);
    const overdueInvR  = db.prepare(`SELECT total, COALESCE(currency,'LKR') as currency FROM invoices WHERE company_id=? AND status='Overdue'`).all(cid);
    const pendingInvAmt = Math.round(sumToLKR(pendingInvR,  'total', 'currency', rates));
    const overdueAmt    = Math.round(sumToLKR(overdueInvR, 'total', 'currency', rates));

    const monthProfit    = monthRevenue - monthExpenses;
    const yearProfit     = yearRevenue  - yearExpenses;
    const lastMonthProfit= lastMonthRev - lastMonthExp;

    const revenueGrowth = lastMonthRev > 0 ? (((monthRevenue - lastMonthRev) / lastMonthRev) * 100).toFixed(1) : 0;
    const profitGrowth  = Math.abs(lastMonthProfit) > 0 ? (((monthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100).toFixed(1) : 0;

    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d      = subMonths(now, i);
      const mStart = format(startOfMonth(d), 'yyyy-MM-dd');
      const mEnd   = format(endOfMonth(d),   'yyyy-MM-dd');

      const rr = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, mStart, mEnd);
      const er = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, mStart, mEnd);

      const rev = Math.round(sumToLKR(rr, 'amount', 'currency', rates));
      const exp = Math.round(sumToLKR(er, 'amount', 'currency', rates));

      chartData.push({
        month:    format(d, 'MMM'),
        revenue:  rev,
        expenses: exp,
        profit:   rev - exp
      });
    }

    const expRows = db.prepare(`SELECT category, amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, thisMonthStart, thisMonthEnd);
    const byCat = {};
    expRows.forEach(r => {
      byCat[r.category] = (byCat[r.category] || 0) + convertToLKR(r.amount, r.currency, rates);
    });
    const expenseBreakdown = Object.entries(byCat)
      .map(([category, total]) => ({ category, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total).slice(0, 6);

    const pendingInvoicesCount = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE company_id=? AND status='Sent'`).get(cid).c;
    const overdueInvoicesCount = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE company_id=? AND status='Overdue'`).get(cid).c;
    const pendingSalariesCount = db.prepare(`SELECT COUNT(*) as c FROM salary_payments WHERE company_id=? AND status='Pending'`).get(cid).c;
    const pendingSalAmt        = Math.round(sumToLKR(db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Pending'`).all(cid), 'net_salary', 'currency', rates));

    const arRecords   = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM revenue WHERE company_id=? AND payment_status='Pending'`).all(cid);
    const receivable  = Math.round(sumToLKR(arRecords, 'amount', 'currency', rates));

    const mrrRecords  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM recurring_payments WHERE company_id=? AND type='Income' AND billing_cycle='Monthly' AND status='Active'`).all(cid);
    const mrr         = Math.round(sumToLKR(mrrRecords, 'amount', 'currency', rates));

    let burnTotal = 0;
    for (let i = 1; i <= 3; i++) {
      const d = subMonths(now, i);
      const er2 = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, format(startOfMonth(d), 'yyyy-MM-dd'), format(endOfMonth(d), 'yyyy-MM-dd'));
      burnTotal += sumToLKR(er2, 'amount', 'currency', rates);
    }
    const burnRate = Math.round(burnTotal / 3);

    const allRevR  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM revenue WHERE company_id=? AND payment_status='Paid'`).all(cid);
    const allExpR  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=?`).all(cid);
    const cashBalance = Math.round(
      sumToLKR(allRevR, 'amount', 'currency', rates) -
      sumToLKR(allExpR, 'amount', 'currency', rates)
    );

    const profitMargin = monthRevenue > 0 ? ((monthProfit / monthRevenue) * 100).toFixed(1) : 0;

    const recentInvoices = db.prepare(`SELECT * FROM invoices WHERE company_id=? ORDER BY created_at DESC LIMIT 5`).all(cid);
    const upcomingPayments = db.prepare(`SELECT * FROM recurring_payments WHERE company_id=? AND status='Active' AND next_payment_date BETWEEN date('now') AND date('now', '+7 days') ORDER BY next_payment_date ASC LIMIT 5`).all(cid);

    const rateCache = db.prepare('SELECT updated_at FROM exchange_rates WHERE id=1').get();

    res.json({
      stats: {
        monthRevenue, yearRevenue, monthExpenses, yearExpenses, monthSalaries, yearSalaries,
        monthProfit, yearProfit,
        profitMargin: parseFloat(String(profitMargin)),
        cashBalance, mrr, burnRate,
        revenueGrowth: parseFloat(String(revenueGrowth)),
        profitGrowth:  parseFloat(String(profitGrowth)),
        pendingInvoices: pendingInvoicesCount, pendingInvoiceAmount: pendingInvAmt,
        overdueInvoices: overdueInvoicesCount, overdueAmount: overdueAmt,
        accountsReceivable: receivable,
        pendingSalaries: pendingSalariesCount, pendingSalaryAmount: pendingSalAmt,
      },
      chartData,
      expenseBreakdown,
      recentInvoices,
      upcomingPayments,
      exchangeRates: {
        rates: rateInfo,
        updated_at: rateCache?.updated_at,
        base: 'USD',
        display: 'All amounts converted to LKR using live rates'
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
