const express = require('express');
const router = express.Router();
const db = require('../database');
const { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } = require('date-fns');
const { getRates, convert, getDisplayRates, sumToCurrency, recordValueInPrimary, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } = require('../services/currencyService');

function mapSalaryRows(rows) {
  return rows.map(r => ({
    amount: r.net_salary,
    amount_primary: r.net_salary_primary,
    currency: r.currency,
  }));
}

function mapInvoiceRows(rows) {
  return rows.map(r => ({
    amount: r.total,
    amount_primary: r.amount_primary,
    currency: r.currency,
  }));
}
const { syncOverdueInvoices } = require('../services/invoiceOverdueSync');

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    syncOverdueInvoices(cid);
    const now = new Date();
    const rates = getRates();
    const settings = db.prepare('SELECT currency, currency_symbol FROM settings WHERE company_id=? LIMIT 1').get(cid) || {};
    let targetCurrency = (settings.currency || 'USD').toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(targetCurrency)) targetCurrency = 'USD';
    const targetSymbol = settings.currency_symbol || CURRENCY_SYMBOLS[targetCurrency] || '$';
    const rateInfo = getDisplayRates(rates, targetCurrency);

    const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const thisMonthEnd   = format(endOfMonth(now),   'yyyy-MM-dd');
    const thisYearStart  = format(startOfYear(now),  'yyyy-MM-dd');
    const thisYearEnd    = format(endOfYear(now),     'yyyy-MM-dd');
    const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
    const lastMonthEnd   = format(endOfMonth(subMonths(now, 1)),   'yyyy-MM-dd');

    const monthRevRecords = db.prepare(`SELECT amount, amount_primary, currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, thisMonthStart, thisMonthEnd);
    const yearRevRecords  = db.prepare(`SELECT amount, amount_primary, currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, thisYearStart, thisYearEnd);
    const lastMonthRevR   = db.prepare(`SELECT amount, amount_primary, currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, lastMonthStart, lastMonthEnd);

    const monthRevenue   = Math.round(sumToCurrency(monthRevRecords, 'amount', 'currency', targetCurrency, rates));
    const yearRevenue    = Math.round(sumToCurrency(yearRevRecords,  'amount', 'currency', targetCurrency, rates));
    const lastMonthRev   = Math.round(sumToCurrency(lastMonthRevR,   'amount', 'currency', targetCurrency, rates));

    const monthExpRecords = db.prepare(`SELECT amount, amount_primary, currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, thisMonthStart, thisMonthEnd);
    const yearExpRecords  = db.prepare(`SELECT amount, amount_primary, currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, thisYearStart, thisYearEnd);
    const lastMonthExpR   = db.prepare(`SELECT amount, amount_primary, currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, lastMonthStart, lastMonthEnd);

    const monthExpenses  = Math.round(sumToCurrency(monthExpRecords, 'amount', 'currency', targetCurrency, rates));
    const yearExpenses   = Math.round(sumToCurrency(yearExpRecords,  'amount', 'currency', targetCurrency, rates));
    const lastMonthExp   = Math.round(sumToCurrency(lastMonthExpR,   'amount', 'currency', targetCurrency, rates));

    const monthSalR = db.prepare(`SELECT net_salary, net_salary_primary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Paid' AND payment_month=?`).all(cid, format(now, 'yyyy-MM'));
    const monthSalaries = Math.round(sumToCurrency(mapSalaryRows(monthSalR), 'amount', 'currency', targetCurrency, rates));

    const yearSalR = db.prepare(`SELECT net_salary, net_salary_primary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Paid' AND payment_month LIKE ?`).all(cid, format(now, 'yyyy') + '-%');
    const yearSalaries = Math.round(sumToCurrency(mapSalaryRows(yearSalR), 'amount', 'currency', targetCurrency, rates));

    const lastMonthSalR = db.prepare(`SELECT net_salary, net_salary_primary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Paid' AND payment_month=?`).all(cid, format(subMonths(now, 1), 'yyyy-MM'));
    const lastMonthSalaries = Math.round(sumToCurrency(mapSalaryRows(lastMonthSalR), 'amount', 'currency', targetCurrency, rates));

    const pendingInvR  = db.prepare(`SELECT total, amount_primary, COALESCE(currency,'LKR') as currency FROM invoices WHERE company_id=? AND status='Sent'`).all(cid);
    const overdueInvR  = db.prepare(`SELECT total, amount_primary, COALESCE(currency,'LKR') as currency FROM invoices WHERE company_id=? AND status='Overdue'`).all(cid);
    const pendingInvAmt = Math.round(sumToCurrency(mapInvoiceRows(pendingInvR), 'amount', 'currency', targetCurrency, rates));
    const overdueAmt    = Math.round(sumToCurrency(mapInvoiceRows(overdueInvR), 'amount', 'currency', targetCurrency, rates));

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

      const rr = db.prepare(`SELECT amount, amount_primary, COALESCE(currency,'LKR') as currency FROM revenue WHERE company_id=? AND payment_status='Paid' AND invoice_date BETWEEN ? AND ?`).all(cid, mStart, mEnd);
      const er = db.prepare(`SELECT amount, amount_primary, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, mStart, mEnd);

      const rev = Math.round(sumToCurrency(rr, 'amount', 'currency', targetCurrency, rates));
      const exp = Math.round(sumToCurrency(er, 'amount', 'currency', targetCurrency, rates));

      chartData.push({
        month:    format(d, 'MMM'),
        revenue:  rev,
        expenses: exp,
        profit:   rev - exp
      });
    }

    const expRows = db.prepare(`SELECT category, amount, amount_primary, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, thisMonthStart, thisMonthEnd);
    const byCat = {};
    expRows.forEach(r => {
      byCat[r.category] = (byCat[r.category] || 0) + recordValueInPrimary(r, 'amount', 'currency', targetCurrency, rates);
    });
    const expenseBreakdown = Object.entries(byCat)
      .map(([category, total]) => ({ category, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total).slice(0, 6);

    const pendingInvoicesCount = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE company_id=? AND status='Sent'`).get(cid).c;
    const overdueInvoicesCount = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE company_id=? AND status='Overdue'`).get(cid).c;
    const pendingSalariesCount = db.prepare(`SELECT COUNT(*) as c FROM salary_payments WHERE company_id=? AND status='Pending'`).get(cid).c;
    const pendingSalAmt        = Math.round(sumToCurrency(mapSalaryRows(db.prepare(`SELECT net_salary, net_salary_primary, COALESCE(currency,'LKR') as currency FROM salary_payments WHERE company_id=? AND status='Pending'`).all(cid)), 'amount', 'currency', targetCurrency, rates));

    const arRecords   = db.prepare(`SELECT amount, amount_primary, COALESCE(currency,'LKR') as currency FROM revenue WHERE company_id=? AND payment_status='Pending'`).all(cid);
    const receivable  = Math.round(sumToCurrency(arRecords, 'amount', 'currency', targetCurrency, rates));

    const mrrRecords  = db.prepare(`SELECT amount, amount_primary, COALESCE(currency,'LKR') as currency FROM recurring_payments WHERE company_id=? AND type='Income' AND billing_cycle='Monthly' AND status='Active'`).all(cid);
    const mrr         = Math.round(sumToCurrency(mrrRecords, 'amount', 'currency', targetCurrency, rates));

    let burnTotal = 0;
    for (let i = 1; i <= 3; i++) {
      const d = subMonths(now, i);
      const er2 = db.prepare(`SELECT amount, amount_primary, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?`).all(cid, format(startOfMonth(d), 'yyyy-MM-dd'), format(endOfMonth(d), 'yyyy-MM-dd'));
      burnTotal += sumToCurrency(er2, 'amount', 'currency', targetCurrency, rates);
    }
    const burnRate = Math.round(burnTotal / 3);

    const allRevR  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM revenue WHERE company_id=? AND payment_status='Paid'`).all(cid);
    const allExpR  = db.prepare(`SELECT amount, COALESCE(currency,'LKR') as currency FROM expenses WHERE company_id=?`).all(cid);
    const cashBalance = Math.round(
      sumToCurrency(allRevR, 'amount', 'currency', targetCurrency, rates) -
      sumToCurrency(allExpR, 'amount', 'currency', targetCurrency, rates)
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
        base: targetCurrency,
        symbol: targetSymbol,
        display: `All amounts converted to ${targetCurrency} using live rates`
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
