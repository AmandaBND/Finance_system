const express = require('express');
const router = express.Router();
const db = require('../database');
const { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } = require('date-fns');
const { getRates, convertToLKR, getDisplayRates, sumToLKR } = require('../services/currencyService');
const { syncOverdueInvoices } = require('../services/invoiceOverdueSync');

router.get('/', (req, res) => {
  try {
    syncOverdueInvoices();
    const now = new Date();
    const rates = getRates(); // Live cached exchange rates (base USD)
    const rateInfo = getDisplayRates(rates);

    const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const thisMonthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');
    const thisYearStart  = format(startOfYear(now),  'yyyy-MM-dd');
    const thisYearEnd    = format(endOfYear(now),     'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const lastMonthEnd   = format(endOfMonth(subMonths(now, 1)),   'yyyy-MM-dd');

    // ── Revenue (multi-currency → LKR) ─────────────────────────────────
    const monthRevRecords = db.prepare(`SELECT amount, currency FROM revenue WHERE payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(thisMonthStart, thisMonthEnd);
    const yearRevRecords  = db.prepare(`SELECT amount, currency FROM revenue WHERE payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(thisYearStart, thisYearEnd);
    const lastMonthRevR   = db.prepare(`SELECT amount, currency FROM revenue WHERE payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(lastMonthStart, lastMonthEnd);

    const monthRevenue   = Math.round(sumToLKR(monthRevRecords, 'amount', 'currency', rates));
    const yearRevenue    = Math.round(sumToLKR(yearRevRecords,  'amount', 'currency', rates));
    const lastMonthRev   = Math.round(sumToLKR(lastMonthRevR,   'amount', 'currency', rates));

    // ── Expenses (multi-currency → LKR) ────────────────────────────────
    const monthExpRecords = db.prepare(`SELECT amount, currency FROM expenses WHERE payment_date BETWEEN ? AND ?`).all(thisMonthStart, thisMonthEnd);
    const yearExpRecords  = db.prepare(`SELECT amount, currency FROM expenses WHERE payment_date BETWEEN ? AND ?`).all(thisYearStart, thisYearEnd);
    const lastMonthExpR   = db.prepare(`SELECT amount, currency FROM expenses WHERE payment_date BETWEEN ? AND ?`).all(lastMonthStart, lastMonthEnd);

    const monthExpenses  = Math.round(sumToLKR(monthExpRecords, 'amount', 'currency', rates));
    const yearExpenses   = Math.round(sumToLKR(yearExpRecords,  'amount', 'currency', rates));
    const lastMonthExp   = Math.round(sumToLKR(lastMonthExpR,   'amount', 'currency', rates));

    // ── Salaries (always LKR) ──────────────────────────────────────────
    const monthSalR = db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE status='Paid' AND payment_month=?`).all(format(now, 'yyyy-MM'));
    const monthSalaries = Math.round(sumToLKR(monthSalR, 'net_salary', 'currency', rates));

    const yearSalR = db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE status='Paid' AND payment_month LIKE ?`).all(format(now, 'yyyy') + '-%');
    const yearSalaries = Math.round(sumToLKR(yearSalR, 'net_salary', 'currency', rates));

    const lastMonthSalR = db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE status='Paid' AND payment_month=?`).all(format(subMonths(now, 1), 'yyyy-MM'));
    const lastMonthSalaries = Math.round(sumToLKR(lastMonthSalR, 'net_salary', 'currency', rates));

    // ── Invoices ───────────────────────────────────────────────────────
    const pendingInvR  = db.prepare(`SELECT total, COALESCE(currency,'LKR') as currency FROM invoices WHERE status='Sent'`).all();
    const overdueInvR  = db.prepare(`SELECT total, COALESCE(currency,'LKR') as currency FROM invoices WHERE status='Overdue'`).all();
    const pendingInvAmt = Math.round(sumToLKR(pendingInvR,  'total', 'currency', rates));
    const overdueAmt    = Math.round(sumToLKR(overdueInvR, 'total', 'currency', rates));

    // ── Profits ────────────────────────────────────────────────────────
    // monthExpenses now includes salary expenses, so don't subtract monthSalaries separately
    const monthProfit    = monthRevenue - monthExpenses;
    const yearProfit     = yearRevenue  - yearExpenses;
    const lastMonthProfit= lastMonthRev - lastMonthExp;

    // ── Growth % ──────────────────────────────────────────────────────
    const revenueGrowth = lastMonthRev > 0 ? (((monthRevenue - lastMonthRev) / lastMonthRev) * 100).toFixed(1) : 0;
    const profitGrowth  = Math.abs(lastMonthProfit) > 0 ? (((monthProfit - lastMonthProfit) / Math.abs(lastMonthProfit)) * 100).toFixed(1) : 0;

    // ── 6-Month Chart (all in LKR) ────────────────────────────────────
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d      = subMonths(now, i);
      const mStart = format(startOfMonth(d), 'yyyy-MM-dd');
      const mEnd   = format(endOfMonth(d),   'yyyy-MM-dd');
      const mMonth = format(d, 'yyyy-MM');

      const rr = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM revenue WHERE payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(mStart, mEnd);
      const er = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE payment_date BETWEEN ? AND ?`).all(mStart, mEnd);

      const rev = Math.round(sumToLKR(rr, 'amount', 'currency', rates));
      const exp = Math.round(sumToLKR(er, 'amount', 'currency', rates));

      chartData.push({
        month:    format(d, 'MMM'),
        revenue:  rev,
        expenses: exp,
        profit:   rev - exp
      });
    }

    // ── Expense breakdown this month (LKR) ────────────────────────────
    const expRows = db.prepare(`SELECT category, amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE payment_date BETWEEN ? AND ?`).all(thisMonthStart, thisMonthEnd);
    const byCat = {};
    expRows.forEach(r => {
      byCat[r.category] = (byCat[r.category] || 0) + convertToLKR(r.amount, r.currency, rates);
    });
    const expenseBreakdown = Object.entries(byCat)
      .map(([category, total]) => ({ category, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total).slice(0, 6);

    // ── Other stats ───────────────────────────────────────────────────
    const pendingInvoicesCount = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE status='Sent'`).get().c;
    const overdueInvoicesCount = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE status='Overdue'`).get().c;
    const pendingSalariesCount = db.prepare(`SELECT COUNT(*) as c FROM salary_payments WHERE status='Pending'`).get().c;
    const pendingSalAmt        = Math.round(sumToLKR(db.prepare(`SELECT net_salary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE status='Pending'`).all(), 'net_salary', 'currency', rates));

    const arRecords   = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM revenue WHERE payment_status='Pending'`).all();
    const receivable  = Math.round(sumToLKR(arRecords, 'amount', 'currency', rates));

    const mrrRecords  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM recurring_payments WHERE type='Income' AND billing_cycle='Monthly' AND status='Active'`).all();
    const mrr         = Math.round(sumToLKR(mrrRecords, 'amount', 'currency', rates));

    // Burn rate: avg monthly expenses (last 3 months) in LKR
    let burnTotal = 0;
    for (let i = 1; i <= 3; i++) {
      const d = subMonths(now, i);
      const er2 = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE payment_date BETWEEN ? AND ?`).all(format(startOfMonth(d), 'yyyy-MM-dd'), format(endOfMonth(d), 'yyyy-MM-dd'));
      burnTotal += sumToLKR(er2, 'amount', 'currency', rates);
    }
    const burnRate = Math.round(burnTotal / 3);

    // Cash balance: total received - total spent (all in LKR)
    // Note: Paid salaries are now in expenses table, so no need to subtract separately
    const allRevR  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM revenue WHERE payment_status='Paid'`).all();
    const allExpR  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM expenses`).all();
    const cashBalance = Math.round(
      sumToLKR(allRevR, 'amount', 'currency', rates) -
      sumToLKR(allExpR, 'amount', 'currency', rates)
    );

    const profitMargin = monthRevenue > 0 ? ((monthProfit / monthRevenue) * 100).toFixed(1) : 0;

    // ── Recent invoices & upcoming payments ───────────────────────────
    const recentInvoices = db.prepare(`SELECT * FROM invoices ORDER BY created_at DESC LIMIT 5`).all();
    const upcomingPayments = db.prepare(`SELECT * FROM recurring_payments WHERE status='Active' AND next_payment_date BETWEEN date('now') AND date('now', '+7 days') ORDER BY next_payment_date ASC LIMIT 5`).all();

    // ── Exchange rate cache info ───────────────────────────────────────
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
