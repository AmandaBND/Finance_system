const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireCompanyAuth } = require('../middleware/companyAuth');

router.get('/:id/usage', requireCompanyAuth, (req, res) => {
  try {
    if (req.params.id !== req.companyId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const cid = req.companyId;
    const invoicesThisMonth = db.prepare(`SELECT COUNT(*) as c FROM invoices WHERE company_id=? AND created_at >= datetime('now','start of month') AND created_at < datetime('now','start of month','+1 month')`).get(cid).c;
    const expensesThisMonth = db.prepare(`SELECT COUNT(*) as c FROM expenses WHERE company_id=? AND created_at >= datetime('now','start of month') AND created_at < datetime('now','start of month','+1 month')`).get(cid).c;
    const totalClients = db.prepare(`SELECT COUNT(*) as c FROM clients WHERE company_id=?`).get(cid).c;
    const totalUsers = db.prepare(`SELECT COUNT(*) as c FROM app_users WHERE company_id=?`).get(cid).c;
    const totalEmployees = db.prepare(`SELECT COUNT(*) as c FROM employees WHERE company_id=? AND status='Active'`).get(cid).c;
    res.json({ invoicesThisMonth, totalClients, expensesThisMonth, totalUsers, totalEmployees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
