const express = require('express');
const router = express.Router();
const db = require('../database');
const employeeAuth = require('../middleware/employeeAuth');
const path = require('path');
const fs = require('fs');
const { generateSalarySlipPDF } = require('../services/pdfService');

router.use(employeeAuth);

router.get('/dashboard', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const cid = req.employee.companyId;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const earnedRow = db.prepare(`SELECT COALESCE(SUM(net_salary), 0) as total FROM salary_payments WHERE company_id=? AND employee_id=? AND status='Paid'`).get(cid, empId);

    const lastSalary = db.prepare(`SELECT * FROM salary_payments WHERE company_id=? AND employee_id=? AND status='Paid' ORDER BY payment_date DESC LIMIT 1`).get(cid, empId);

    let leaveBalance = db.prepare(`SELECT * FROM employee_leaves WHERE company_id=? AND employee_id=? AND year=?`).get(cid, empId, currentYear);
    if (!leaveBalance) {
      db.prepare(`INSERT OR IGNORE INTO employee_leaves (employee_id, year, company_id) VALUES (?,?,?)`).run(empId, currentYear, cid);
      leaveBalance = db.prepare(`SELECT * FROM employee_leaves WHERE company_id=? AND employee_id=? AND year=?`).get(cid, empId, currentYear);
    }

    const kpiThisMonth = db.prepare(`SELECT * FROM employee_kpi WHERE company_id=? AND employee_id=? AND month=?`).get(cid, empId, currentMonth);

    const recentSalaries = db.prepare(`SELECT * FROM salary_payments WHERE company_id=? AND employee_id=? ORDER BY created_at DESC LIMIT 5`).all(cid, empId);

    const recentLeaves = db.prepare(`SELECT * FROM employee_leave_requests WHERE company_id=? AND employee_id=? ORDER BY requested_at DESC LIMIT 5`).all(cid, empId);

    const pendingLeaveCount = db.prepare(`SELECT COUNT(*) as c FROM employee_leave_requests WHERE company_id=? AND employee_id=? AND status='Pending'`).get(cid, empId).c;

    res.json({
      stats: {
        totalEarned: earnedRow.total,
        lastNetSalary: lastSalary?.net_salary || 0,
        lastPaymentMonth: lastSalary?.payment_month || null,
        leaveBalance,
        kpiThisMonth: kpiThisMonth?.performance_score || null,
        kpiTarget: kpiThisMonth?.kpi_target || 80,
        pendingLeaveCount,
      },
      recentSalaries,
      recentLeaves,
    });
  } catch (err) {
    console.error('Employee dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/salaries', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const cid = req.employee.companyId;
    const { month } = req.query;
    let q = `SELECT * FROM salary_payments WHERE company_id=? AND employee_id=?`;
    const params = [cid, empId];
    if (month) { q += ` AND payment_month=?`; params.push(month); }
    q += ` ORDER BY payment_month DESC, created_at DESC`;
    const salaries = db.prepare(q).all(...params);
    res.json(salaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/salaries/:id/pdf', async (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const cid = req.employee.companyId;
    const salary = db.prepare(`SELECT * FROM salary_payments WHERE company_id=? AND id=? AND employee_id=?`).get(cid, req.params.id, empId);
    if (!salary) return res.status(404).json({ error: 'Salary record not found' });

    if (salary.pdf_path && fs.existsSync(path.join(__dirname, '../../', salary.pdf_path))) {
      return res.sendFile(path.resolve(path.join(__dirname, '../../', salary.pdf_path)));
    }

    const settings = db.prepare(`SELECT * FROM settings WHERE company_id=? LIMIT 1`).get(cid) || {};
    const pdfPath = await generateSalarySlipPDF(salary, settings);
    res.sendFile(path.resolve(pdfPath));
  } catch (err) {
    console.error('Employee PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaves', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const cid = req.employee.companyId;
    const currentYear = new Date().getFullYear();

    let balance = db.prepare(`SELECT * FROM employee_leaves WHERE company_id=? AND employee_id=? AND year=?`).get(cid, empId, currentYear);
    if (!balance) {
      db.prepare(`INSERT OR IGNORE INTO employee_leaves (employee_id, year, company_id) VALUES (?,?,?)`).run(empId, currentYear, cid);
      balance = db.prepare(`SELECT * FROM employee_leaves WHERE company_id=? AND employee_id=? AND year=?`).get(cid, empId, currentYear);
    }

    const requests = db.prepare(`SELECT * FROM employee_leave_requests WHERE company_id=? AND employee_id=? ORDER BY requested_at DESC`).all(cid, empId);

    res.json({ balance, requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/leaves/request', async (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const cid = req.employee.companyId;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'leave_type, start_date and end_date are required' });
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    const days_count = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    const result = db.prepare(`
      INSERT INTO employee_leave_requests (employee_id, employee_name, leave_type, start_date, end_date, days_count, reason, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(empId, req.employee.employeeName, leave_type, start_date, end_date, days_count, reason || null, cid);

    db.prepare(`
      INSERT INTO notifications (type, title, message, related_id, related_type, company_id)
      VALUES ('info', 'Leave Request', ?, ?, 'leave_request', ?)
    `).run(
      `${req.employee.employeeName} has requested ${days_count} day(s) of ${leave_type} leave (${start_date} to ${end_date}).`,
      result.lastInsertRowid,
      cid
    );

    try {
      const settings = db.prepare(`SELECT * FROM settings WHERE company_id=? LIMIT 1`).get(cid) || {};
      const { sendLeaveRequestEmail } = require('../services/emailService');
      if (sendLeaveRequestEmail && settings.smtp_user) {
        await sendLeaveRequestEmail(req.employee, { leave_type, start_date, end_date, days_count, reason }, settings);
      }
    } catch (emailErr) {
      console.error('Leave request email error:', emailErr.message);
    }

    res.json({ id: result.lastInsertRowid, message: 'Leave request submitted' });
  } catch (err) {
    console.error('Leave request error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/kpi', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const cid = req.employee.companyId;
    const kpi = db.prepare(`SELECT * FROM employee_kpi WHERE company_id=? AND employee_id=? ORDER BY month DESC LIMIT 12`).all(cid, empId);
    res.json(kpi);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
