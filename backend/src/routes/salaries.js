const express = require('express');
const router = express.Router();
const db = require('../database');
const { format } = require('date-fns');
const { generateSalarySlipPDF } = require('../services/pdfService');
const { sendSalarySlipEmail } = require('../services/emailService');

// Sync salary payment to expenses table
function syncSalaryExpense(sal) {
  if (!sal || !sal.id || sal.status !== 'Paid') return;
  const paidDate = sal.payment_date || format(new Date(), 'yyyy-MM-dd');
  const existing = db.prepare(`SELECT id FROM expenses WHERE salary_payment_id=?`).get(sal.id);
  const amount = parseFloat(sal.net_salary || 0);
  const currency = sal.currency || 'LKR';
  const category = 'Payroll';
  const title = `Salary - ${sal.employee_name}`;
  const notes = `Auto-recorded from Salary Payment #${sal.id} for ${sal.payment_month}`;

  if (existing) {
    db.prepare(`
      UPDATE expenses SET title=?, category=?, amount=?, payment_date=?, currency=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(title, category, amount, paidDate, currency, notes, existing.id);
  } else {
    db.prepare(`
      INSERT INTO expenses (title, category, vendor, amount, payment_date, payment_method, currency, salary_payment_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, category, sal.employee_name, amount, paidDate, 'Bank Transfer', currency, sal.id, notes);
  }
}

// Remove salary expense when salary is deleted
function removeSalaryExpense(sal) {
  if (!sal || !sal.id) return;
  db.prepare(`DELETE FROM expenses WHERE salary_payment_id=?`).run(sal.id);
}

router.get('/', (req, res) => {
  try {
    const { month, status } = req.query;
    let query = 'SELECT * FROM salary_payments WHERE 1=1';
    const params = [];
    if (month) { query += ' AND payment_month=?'; params.push(month); }
    if (status) { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const { employee_id, employee_name, position, department, salary_type, base_salary, bonuses, deductions, payment_month, payment_date, payment_method, notes, currency } = req.body;
    const net_salary = (parseFloat(base_salary) || 0) + (parseFloat(bonuses) || 0) - (parseFloat(deductions) || 0);
    const currencyVal = currency || 'LKR';
    const result = db.prepare(`
      INSERT INTO salary_payments (employee_id, employee_name, position, department, salary_type, base_salary, bonuses, deductions, net_salary, payment_month, payment_date, payment_method, notes, currency)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(employee_id, employee_name, position, department, salary_type || 'Monthly', base_salary, bonuses || 0, deductions || 0, net_salary, payment_month || format(new Date(), 'yyyy-MM'), payment_date, payment_method || 'Bank Transfer', notes, currencyVal);
    res.json({ id: result.lastInsertRowid, message: 'Salary record created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const { base_salary, bonuses, deductions, payment_date, payment_method, status, notes, currency } = req.body;
    const net_salary = (parseFloat(base_salary) || 0) + (parseFloat(bonuses) || 0) - (parseFloat(deductions) || 0);
    db.prepare(`UPDATE salary_payments SET base_salary=?, bonuses=?, deductions=?, net_salary=?, payment_date=?, payment_method=?, status=?, notes=?, currency=? WHERE id=?`).run(base_salary, bonuses || 0, deductions || 0, net_salary, payment_date, payment_method, status, notes, currency || 'LKR', req.params.id);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=?').get(req.params.id);
    if (sal) removeSalaryExpense(sal);
    db.prepare('DELETE FROM salary_payments WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark as paid and send salary slip
router.post('/:id/pay', async (req, res) => {
  try {
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=?').get(req.params.id);
    if (!sal) return res.status(404).json({ error: 'Not found' });
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();

    const paidDate = format(new Date(), 'yyyy-MM-dd');
    db.prepare(`UPDATE salary_payments SET status='Paid', payment_date=COALESCE(payment_date, ?) WHERE id=?`).run(paidDate, sal.id);
    const updatedSal = db.prepare('SELECT * FROM salary_payments WHERE id=?').get(sal.id);
    if (updatedSal) syncSalaryExpense(updatedSal);

    // Find employee email
    const emp = sal.employee_id ? db.prepare('SELECT * FROM employees WHERE id=?').get(sal.employee_id) : null;
    const empEmail = emp?.email;

    if (empEmail) {
      try {
        const pdfPath = await generateSalarySlipPDF(updatedSal, settings);
        await sendSalarySlipEmail(updatedSal, empEmail, pdfPath, settings);
        db.prepare(`UPDATE salary_payments SET slip_sent=1, slip_sent_at=CURRENT_TIMESTAMP WHERE id=?`).run(sal.id);
      } catch (emailErr) {
        console.error('Salary slip email failed (payment still processed):', emailErr.message);
      }
    }

    db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('success', 'Salary Paid', ?)`).run(`Salary paid to ${sal.employee_name}`);

    // Notify employee portal dashboard if employee has portal access
    if (sal.employee_id) {
      const empCred = db.prepare(`SELECT id FROM employee_credentials WHERE employee_id=? AND is_active=1`).get(sal.employee_id);
      if (empCred) {
        db.prepare(`INSERT INTO notifications (type, title, message, related_id, related_type) VALUES ('success', ?, ?, ?, 'salary')`).run(
          'Salary Paid',
          `Your salary for ${updatedSal.payment_month} has been processed. Net amount: ${updatedSal.currency || 'LKR'} ${updatedSal.net_salary}.`,
          sal.id
        );
      }
    }

    res.json({ message: `Salary processed${empEmail ? ' and slip sent' : ''}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Send salary slip only
router.post('/:id/send-slip', async (req, res) => {
  try {
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=?').get(req.params.id);
    if (!sal) return res.status(404).json({ error: 'Not found' });
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const emp = sal.employee_id ? db.prepare('SELECT * FROM employees WHERE id=?').get(sal.employee_id) : null;
    const empEmail = req.body.email || emp?.email;
    if (!empEmail) return res.status(400).json({ error: 'Employee email not found' });

    const pdfPath = await generateSalarySlipPDF(sal, settings);
    await sendSalarySlipEmail(sal, empEmail, pdfPath, settings);
    db.prepare(`UPDATE salary_payments SET slip_sent=1, slip_sent_at=CURRENT_TIMESTAMP WHERE id=?`).run(sal.id);
    res.json({ message: `Slip sent to ${empEmail}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Download PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=?').get(req.params.id);
    if (!sal) return res.status(404).json({ error: 'Not found' });
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const pdfPath = await generateSalarySlipPDF(sal, settings);
    res.download(pdfPath, `SalarySlip-${sal.employee_name}-${sal.payment_month}.pdf`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Generate payroll for all active employees
router.post('/generate', (req, res) => {
  try {
    const { payment_month } = req.body;
    const month = payment_month || format(new Date(), 'yyyy-MM');
    const employees = db.prepare(`SELECT * FROM employees WHERE status='Active'`).all();
    let created = 0;
    employees.forEach(emp => {
      const exists = db.prepare('SELECT id FROM salary_payments WHERE employee_id=? AND payment_month=?').get(emp.id, month);
      if (!exists) {
        db.prepare(`INSERT INTO salary_payments (employee_id, employee_name, position, department, salary_type, base_salary, net_salary, payment_month, payment_method) VALUES (?,?,?,?,?,?,?,?,?)`).run(emp.id, emp.name, emp.position, emp.department, emp.salary_type, emp.base_salary, emp.base_salary, month, 'Bank Transfer');
        created++;
      }
    });
    res.json({ message: `Generated ${created} salary records for ${month}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
