const express = require('express');
const router = express.Router();
const db = require('../database');
const { format } = require('date-fns');
const { generateInvoicePDF } = require('../services/pdfService');
const { sendInvoiceEmail } = require('../services/emailService');

function syncInvoiceRevenue(inv) {
  if (!inv || !inv.invoice_number) return;
  const existing = db.prepare(`SELECT * FROM revenue WHERE invoice_number=?`).get(inv.invoice_number);
  const invoiceDate = inv.issue_date || format(new Date(), 'yyyy-MM-dd');
  const paidDate = inv.paid_date || (inv.status === 'Paid' ? format(new Date(), 'yyyy-MM-dd') : null);
  const paymentStatus = inv.status === 'Paid' ? 'Paid' : 'Pending';
  const amount = parseFloat(inv.total || 0);
  const currency = inv.currency || 'LKR';
  const paymentMethod = inv.payment_methods || 'Bank Transfer';
  const notes = `Auto-recorded from Invoice #${inv.invoice_number}`;

  if (existing) {
    db.prepare(`
      UPDATE revenue SET client_name=?, project_name=?, service_type=?, invoice_date=?, due_date=?, amount=?, payment_status=?, payment_method=?, is_recurring=0, billing_cycle='One-time', notes=?, currency=?, auto_recorded=1, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      inv.client_name,
      null,
      null,
      paidDate || invoiceDate,
      inv.due_date,
      amount,
      paymentStatus,
      paymentMethod,
      notes,
      currency,
      existing.id
    );
  } else if (['Sent', 'Overdue', 'Paid'].includes(inv.status)) {
    db.prepare(`
      INSERT INTO revenue (client_name, project_name, service_type, invoice_number, invoice_date, due_date, amount, payment_status, payment_method, is_recurring, billing_cycle, notes, currency, auto_recorded)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
    `).run(
      inv.client_name,
      null,
      null,
      inv.invoice_number,
      paidDate || invoiceDate,
      inv.due_date,
      amount,
      paymentStatus,
      paymentMethod,
      0,
      'One-time',
      notes,
      currency
    );
  }
}

function generateInvoiceNumber() {
  const settings = db.prepare('SELECT invoice_prefix FROM settings WHERE id=1').get();
  const prefix = settings?.invoice_prefix || 'INV';
  const count = db.prepare('SELECT COUNT(*) as c FROM invoices').get().c + 1;
  return `${prefix}-${String(count).padStart(4, '0')}-${format(new Date(), 'yyyy')}`;
}

const CURRENCY_SYMBOLS = {
  LKR: 'Rs.', USD: '$', EUR: '€', GBP: '£',
  AUD: 'A$', SGD: 'S$', INR: '₹', CAD: 'C$', JPY: '¥'
};

router.get('/', (req, res) => {
  try {
    const { status, search } = req.query;
    let query = 'SELECT * FROM invoices WHERE 1=1';
    const params = [];
    if (status) { query += ' AND status=?'; params.push(status); }
    if (search) { query += ' AND (client_name LIKE ? OR invoice_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    query += ' ORDER BY created_at DESC';
    const invoices = db.prepare(query).all(...params);
    invoices.forEach(inv => {
      inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id);
    });
    res.json(invoices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', (req, res) => {
  try {
    const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id);
    res.json(inv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const {
      client_id, client_name, client_email, client_address, client_company,
      issue_date, due_date, items, tax_rate, discount, notes, terms, status,
      currency = 'LKR', payment_methods = 'bank'
    } = req.body;
    const invoice_number = generateInvoiceNumber();
    const currency_symbol = CURRENCY_SYMBOLS[currency] || currency;
    const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0);
    const tax_amount = (subtotal * (parseFloat(tax_rate) || 0)) / 100;
    const total = subtotal + tax_amount - (parseFloat(discount) || 0);

    const result = db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, client_name, client_email, client_address, client_company,
        issue_date, due_date, subtotal, tax_rate, tax_amount, discount, total,
        status, notes, terms, currency, currency_symbol, payment_methods)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(invoice_number, client_id || null, client_name, client_email, client_address, client_company,
      issue_date, due_date, subtotal, tax_rate || 0, tax_amount, discount || 0, total,
      status || 'Draft', notes, terms, currency, currency_symbol, payment_methods);

    const invoiceId = result.lastInsertRowid;
    items.forEach(item => {
      db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?,?,?,?,?)`)
        .run(invoiceId, item.description, item.quantity, item.unit_price,
          parseFloat(item.quantity) * parseFloat(item.unit_price));
    });

    const newInvoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(invoiceId);
    if (newInvoice) syncInvoiceRevenue(newInvoice);

    res.json({ id: invoiceId, invoice_number, message: 'Invoice created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const {
      client_id, client_name, client_email, client_address, client_company,
      issue_date, due_date, items, tax_rate, discount, notes, terms, status, paid_date,
      currency = 'LKR', payment_methods = 'bank'
    } = req.body;
    const currency_symbol = CURRENCY_SYMBOLS[currency] || currency;
    const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.unit_price)), 0);
    const tax_amount = (subtotal * (parseFloat(tax_rate) || 0)) / 100;
    const total = subtotal + tax_amount - (parseFloat(discount) || 0);

    db.prepare(`
      UPDATE invoices SET client_id=?, client_name=?, client_email=?, client_address=?, client_company=?,
        issue_date=?, due_date=?, subtotal=?, tax_rate=?, tax_amount=?, discount=?, total=?,
        status=?, notes=?, terms=?, paid_date=?, currency=?, currency_symbol=?, payment_methods=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(client_id || null, client_name, client_email, client_address, client_company,
      issue_date, due_date, subtotal, tax_rate || 0, tax_amount, discount || 0, total,
      status, notes, terms, paid_date || null, currency, currency_symbol, payment_methods, req.params.id);

    db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(req.params.id);
    items.forEach(item => {
      db.prepare(`INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?,?,?,?,?)`)
        .run(req.params.id, item.description, item.quantity, item.unit_price,
          parseFloat(item.quantity) * parseFloat(item.unit_price));
    });

    const updatedInvoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
    if (updatedInvoice) syncInvoiceRevenue(updatedInvoice);

    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
    if (inv) {
      db.prepare('DELETE FROM revenue WHERE invoice_number=? AND auto_recorded=1').run(inv.invoice_number);
    }
    db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Send invoice to client portal (+ optional email notification)
router.post('/:id/send', async (req, res) => {
  try {
    const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id);

    // ✅ ALWAYS update status to Sent first — invoice appears in client portal regardless of email
    db.prepare(`UPDATE invoices SET status='Sent', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(inv.id);
    db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('success', 'Invoice Sent to Portal', ?)`)
      .run(`Invoice ${inv.invoice_number} is now visible in ${inv.client_name}'s client portal`);

    // 📧 Try to send email — failure is non-fatal, portal visibility is already set
    let emailSent = false;
    if (inv.client_email) {
      try {
        const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
        const emailSettings = { ...settings, currency_symbol: inv.currency_symbol || settings.currency_symbol || 'Rs.' };
        const pdfPath = await generateInvoicePDF(inv, emailSettings);
        await sendInvoiceEmail(inv, pdfPath, emailSettings);
        db.prepare(`UPDATE invoices SET email_sent=1, email_sent_at=CURRENT_TIMESTAMP WHERE id=?`).run(inv.id);
        emailSent = true;
      } catch (emailErr) {
        console.error('Invoice email failed (portal still updated):', emailErr.message);
      }
    }

    res.json({
      message: emailSent
        ? `Invoice sent to client portal and emailed to ${inv.client_email}`
        : `Invoice published to client portal${inv.client_email ? ' (email delivery failed — check SMTP settings)' : ''}`,
      emailSent
    });
  } catch (err) {
    console.error('Send invoice error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Mark as paid → AUTO-RECORD in Revenue with correct currency
router.post('/:id/mark-paid', (req, res) => {
  try {
    const { paid_date } = req.body;
    const paidDate = paid_date || format(new Date(), 'yyyy-MM-dd');
    const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    db.prepare(`UPDATE invoices SET status='Paid', paid_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(paidDate, inv.id);
    const updatedInvoice = db.prepare('SELECT * FROM invoices WHERE id=?').get(inv.id);
    if (updatedInvoice) syncInvoiceRevenue({ ...updatedInvoice, paid_date: paidDate });

    const sym = updatedInvoice.currency_symbol || updatedInvoice.currency || 'Rs.';
    db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('success', 'Invoice Paid & Revenue Recorded', ?)`)
      .run(`Invoice ${updatedInvoice.invoice_number} paid. ${sym} ${Number(updatedInvoice.total).toLocaleString()} recorded in Revenue automatically.`);

    res.json({ message: 'Marked as paid and recorded in revenue' });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download PDF (uses invoice's own currency)
router.get('/:id/pdf', async (req, res) => {
  try {
    const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    inv.items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id=?').all(inv.id);
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const pdfSettings = { ...settings, currency_symbol: inv.currency_symbol || settings.currency_symbol || 'Rs.' };
    const pdfPath = await generateInvoicePDF(inv, pdfSettings);
    res.download(pdfPath, `Invoice-${inv.invoice_number}.pdf`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
