const express = require('express');
const router = express.Router();
const db = require('../database');
const employeeAuth = require('../middleware/employeeAuth');
const path = require('path');
const fs = require('fs');
const { generateSalarySlipPDF } = require('../services/pdfService');

// All routes require employee auth
router.use(employeeAuth);

// GET /api/employee/dashboard
router.get('/dashboard', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Total earned (all paid salaries)
    const earnedRow = db.prepare(`SELECT COALESCE(SUM(net_salary), 0) as total FROM salary_payments WHERE employee_id=? AND status='Paid'`).get(empId);

    // Last salary
    const lastSalary = db.prepare(`SELECT * FROM salary_payments WHERE employee_id=? AND status='Paid' ORDER BY payment_date DESC LIMIT 1`).get(empId);

    // Leave balance current year
    let leaveBalance = db.prepare(`SELECT * FROM employee_leaves WHERE employee_id=? AND year=?`).get(empId, currentYear);
    if (!leaveBalance) {
      // Auto-create row with defaults
      db.prepare(`INSERT OR IGNORE INTO employee_leaves (employee_id, year) VALUES (?, ?)`).run(empId, currentYear);
      leaveBalance = db.prepare(`SELECT * FROM employee_leaves WHERE employee_id=? AND year=?`).get(empId, currentYear);
    }

    // KPI this month
    const kpiThisMonth = db.prepare(`SELECT * FROM employee_kpi WHERE employee_id=? AND month=?`).get(empId, currentMonth);

    // Recent 5 salaries
    const recentSalaries = db.prepare(`SELECT * FROM salary_payments WHERE employee_id=? ORDER BY created_at DESC LIMIT 5`).all(empId);

    // Recent leave requests
    const recentLeaves = db.prepare(`SELECT * FROM employee_leave_requests WHERE employee_id=? ORDER BY requested_at DESC LIMIT 5`).all(empId);

    // Pending leave count
    const pendingLeaveCount = db.prepare(`SELECT COUNT(*) as c FROM employee_leave_requests WHERE employee_id=? AND status='Pending'`).get(empId).c;

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

// GET /api/employee/salaries
router.get('/salaries', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const { month } = req.query;
    let q = `SELECT * FROM salary_payments WHERE employee_id=?`;
    const params = [empId];
    if (month) { q += ` AND payment_month=?`; params.push(month); }
    q += ` ORDER BY payment_month DESC, created_at DESC`;
    const salaries = db.prepare(q).all(...params);
    res.json(salaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employee/salaries/:id/pdf
router.get('/salaries/:id/pdf', async (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const salary = db.prepare(`SELECT * FROM salary_payments WHERE id=? AND employee_id=?`).get(req.params.id, empId);
    if (!salary) return res.status(404).json({ error: 'Salary record not found' });

    // If PDF already exists, serve it
    if (salary.pdf_path && fs.existsSync(path.join(__dirname, '../../', salary.pdf_path))) {
      return res.sendFile(path.resolve(path.join(__dirname, '../../', salary.pdf_path)));
    }

    // Generate on-demand
    const settings = db.prepare(`SELECT * FROM settings WHERE id=1`).get() || {};
    const pdfPath = await generateSalarySlipPDF(salary, settings);
    res.sendFile(path.resolve(pdfPath));
  } catch (err) {
    console.error('Employee PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/employee/leaves
router.get('/leaves', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const currentYear = new Date().getFullYear();

    let balance = db.prepare(`SELECT * FROM employee_leaves WHERE employee_id=? AND year=?`).get(empId, currentYear);
    if (!balance) {
      db.prepare(`INSERT OR IGNORE INTO employee_leaves (employee_id, year) VALUES (?, ?)`).run(empId, currentYear);
      balance = db.prepare(`SELECT * FROM employee_leaves WHERE employee_id=? AND year=?`).get(empId, currentYear);
    }

    const requests = db.prepare(`SELECT * FROM employee_leave_requests WHERE employee_id=? ORDER BY requested_at DESC`).all(empId);

    res.json({ balance, requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/employee/leaves/request
router.post('/leaves/request', async (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({ error: 'leave_type, start_date and end_date are required' });
    }

    // Calculate days (simple calendar days)
    const start = new Date(start_date);
    const end = new Date(end_date);
    const days_count = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

    const result = db.prepare(`
      INSERT INTO employee_leave_requests (employee_id, employee_name, leave_type, start_date, end_date, days_count, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(empId, req.employee.employeeName, leave_type, start_date, end_date, days_count, reason || null);

    // Create admin notification
    db.prepare(`
      INSERT INTO notifications (type, title, message, related_id, related_type)
      VALUES ('info', 'Leave Request', ?, ?, 'leave_request')
    `).run(
      `${req.employee.employeeName} has requested ${days_count} day(s) of ${leave_type} leave (${start_date} to ${end_date}).`,
      result.lastInsertRowid
    );

    // Send email to admin
    try {
      const settings = db.prepare(`SELECT * FROM settings WHERE id=1`).get() || {};
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

// GET /api/employee/kpi
router.get('/kpi', (req, res) => {
  try {
    const empId = req.employee.employeeId;
    const kpi = db.prepare(`SELECT * FROM employee_kpi WHERE employee_id=? ORDER BY month DESC LIMIT 12`).all(empId);
    res.json(kpi);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
