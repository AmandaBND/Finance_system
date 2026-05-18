const express = require('express');
const router = express.Router();
const db = require('../database');
const { format } = require('date-fns');
const { generateSalarySlipPDF } = require('../services/pdfService');
const { sendSalarySlipEmail } = require('../services/emailService');

function syncSalaryExpense(sal) {
  if (!sal || !sal.id || sal.status !== 'Paid' || !sal.company_id) return;
  const cid = sal.company_id;
  const paidDate = sal.payment_date || format(new Date(), 'yyyy-MM-dd');
  const existing = db.prepare(`SELECT id FROM expenses WHERE company_id=? AND salary_payment_id=?`).get(cid, sal.id);
  const amount = parseFloat(sal.net_salary || 0);
  const currency = sal.currency || 'LKR';
  const category = 'Payroll';
  const title = `Salary - ${sal.employee_name}`;
  const notes = `Auto-recorded from Salary Payment #${sal.id} for ${sal.payment_month}`;

  if (existing) {
    db.prepare(`
      UPDATE expenses SET title=?, category=?, amount=?, payment_date=?, currency=?, notes=?
      WHERE id=? AND company_id=?
    `).run(title, category, amount, paidDate, currency, notes, existing.id, cid);
  } else {
    db.prepare(`
      INSERT INTO expenses (title, category, vendor, amount, payment_date, payment_method, currency, salary_payment_id, notes, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, category, sal.employee_name, amount, paidDate, 'Bank Transfer', currency, sal.id, notes, cid);
  }
}

function removeSalaryExpense(sal) {
  if (!sal || !sal.id || !sal.company_id) return;
  db.prepare(`DELETE FROM expenses WHERE salary_payment_id=? AND company_id=?`).run(sal.id, sal.company_id);
}

router.get('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { month, status } = req.query;
    let query = 'SELECT * FROM salary_payments WHERE company_id=?';
    const params = [cid];
    if (month) { query += ' AND payment_month=?'; params.push(month); }
    if (status) { query += ' AND status=?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const cid = req.companyId;
    const { employee_id, employee_name, position, department, salary_type, base_salary, bonuses, deductions, payment_month, payment_date, payment_method, notes, currency } = req.body;
    const net_salary = (parseFloat(base_salary) || 0) + (parseFloat(bonuses) || 0) - (parseFloat(deductions) || 0);
    const currencyVal = currency || 'LKR';
    const result = db.prepare(`
      INSERT INTO salary_payments (employee_id, employee_name, position, department, salary_type, base_salary, bonuses, deductions, net_salary, payment_month, payment_date, payment_method, notes, currency, company_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(employee_id, employee_name, position, department, salary_type || 'Monthly', base_salary, bonuses || 0, deductions || 0, net_salary, payment_month || format(new Date(), 'yyyy-MM'), payment_date, payment_method || 'Bank Transfer', notes, currencyVal, cid);
    res.json({ id: result.lastInsertRowid, message: 'Salary record created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const { base_salary, bonuses, deductions, payment_date, payment_method, status, notes, currency } = req.body;
    const net_salary = (parseFloat(base_salary) || 0) + (parseFloat(bonuses) || 0) - (parseFloat(deductions) || 0);
    const r = db.prepare(`UPDATE salary_payments SET base_salary=?, bonuses=?, deductions=?, net_salary=?, payment_date=?, payment_method=?, status=?, notes=?, currency=? WHERE id=? AND company_id=?`).run(base_salary, bonuses || 0, deductions || 0, net_salary, payment_date, payment_method, status, notes, currency || 'LKR', req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (sal) removeSalaryExpense(sal);
    const r = db.prepare('DELETE FROM salary_payments WHERE id=? AND company_id=?').run(req.params.id, cid);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/pay', async (req, res) => {
  try {
    const cid = req.companyId;
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!sal) return res.status(404).json({ error: 'Not found' });
    const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(cid);

    const paidDate = format(new Date(), 'yyyy-MM-dd');
    db.prepare(`UPDATE salary_payments SET status='Paid', payment_date=COALESCE(payment_date, ?) WHERE id=? AND company_id=?`).run(paidDate, sal.id, cid);
    const updatedSal = db.prepare('SELECT * FROM salary_payments WHERE id=? AND company_id=?').get(sal.id, cid);
    if (updatedSal) syncSalaryExpense(updatedSal);

    const emp = sal.employee_id ? db.prepare('SELECT * FROM employees WHERE id=? AND company_id=?').get(sal.employee_id, cid) : null;
    const empEmail = emp?.email;

    if (empEmail) {
      try {
        const pdfPath = await generateSalarySlipPDF(updatedSal, settings);
        await sendSalarySlipEmail(updatedSal, empEmail, pdfPath, settings);
        db.prepare(`UPDATE salary_payments SET slip_sent=1, slip_sent_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`).run(sal.id, cid);
      } catch (emailErr) {
        console.error('Salary slip email failed (payment still processed):', emailErr.message);
      }
    }

    db.prepare(`INSERT INTO notifications (type, title, message, company_id) VALUES ('success', 'Salary Paid', ?, ?)`).run(`Salary paid to ${sal.employee_name}`, cid);

    if (sal.employee_id) {
      const empCred = db.prepare(`SELECT id FROM employee_credentials WHERE employee_id=? AND is_active=1`).get(sal.employee_id);
      if (empCred) {
        db.prepare(`INSERT INTO notifications (type, title, message, related_id, related_type, company_id) VALUES ('success', ?, ?, ?, 'salary', ?)`).run(
          'Salary Paid',
          `Your salary for ${updatedSal.payment_month} has been processed. Net amount: ${updatedSal.currency || 'LKR'} ${updatedSal.net_salary}.`,
          sal.id,
          cid
        );
      }
    }

    res.json({ message: `Salary processed${empEmail ? ' and slip sent' : ''}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/send-slip', async (req, res) => {
  try {
    const cid = req.companyId;
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!sal) return res.status(404).json({ error: 'Not found' });
    const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(cid);
    const emp = sal.employee_id ? db.prepare('SELECT * FROM employees WHERE id=? AND company_id=?').get(sal.employee_id, cid) : null;
    const empEmail = req.body.email || emp?.email;
    if (!empEmail) return res.status(400).json({ error: 'Employee email not found' });

    const pdfPath = await generateSalarySlipPDF(sal, settings);
    await sendSalarySlipEmail(sal, empEmail, pdfPath, settings);
    db.prepare(`UPDATE salary_payments SET slip_sent=1, slip_sent_at=CURRENT_TIMESTAMP WHERE id=? AND company_id=?`).run(sal.id, cid);
    res.json({ message: `Slip sent to ${empEmail}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const cid = req.companyId;
    const sal = db.prepare('SELECT * FROM salary_payments WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!sal) return res.status(404).json({ error: 'Not found' });
    const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(cid);
    const pdfPath = await generateSalarySlipPDF(sal, settings);
    res.download(pdfPath, `SalarySlip-${sal.employee_name}-${sal.payment_month}.pdf`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/generate', (req, res) => {
  try {
    const cid = req.companyId;
    const { payment_month } = req.body;
    const month = payment_month || format(new Date(), 'yyyy-MM');
    const employees = db.prepare(`SELECT * FROM employees WHERE company_id=? AND status='Active'`).all(cid);
    let created = 0;
    employees.forEach(emp => {
      const exists = db.prepare('SELECT id FROM salary_payments WHERE company_id=? AND employee_id=? AND payment_month=?').get(cid, emp.id, month);
      if (!exists) {
        db.prepare(`INSERT INTO salary_payments (employee_id, employee_name, position, department, salary_type, base_salary, net_salary, payment_month, payment_method, company_id) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(emp.id, emp.name, emp.position, emp.department, emp.salary_type, emp.base_salary, emp.base_salary, month, 'Bank Transfer', cid);
        created++;
      }
    });
    res.json({ message: `Generated ${created} salary records for ${month}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
