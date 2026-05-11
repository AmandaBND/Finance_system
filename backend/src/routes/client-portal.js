const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const db = require('../database');
const clientAuth = require('../middleware/clientAuth');
const { generateInvoicePDF } = require('../services/pdfService');

const slipStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads/payment-slips'),
  filename: (req, file, cb) => cb(null, `slip-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`)
});
const uploadSlip = multer({ storage: slipStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// All routes below require client auth
router.use(clientAuth);

// Helper: SQL condition to match an invoice to a client by id OR email fallback
// This handles invoices created before client_id was saved, or typed-in clients
// alias='' means no table prefix (single-table queries), alias='i' means "i.column"
function clientInvoiceWhere(alias = 'i') {
  const p = alias ? `${alias}.` : '';
  return `(${p}client_id=? OR (${p}client_id IS NULL AND ${p}client_email=?))`;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  try {
    const { clientId, clientEmail } = req.client;

    const invoices = db.prepare(
      `SELECT * FROM invoices WHERE ${clientInvoiceWhere('')} AND status!='Draft' ORDER BY created_at DESC`
    ).all(clientId, clientEmail || '');
    const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0);
    const totalPending = invoices.filter(i => i.status === 'Sent').reduce((s, i) => s + i.total, 0);
    const totalOverdue = invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + i.total, 0);

    // Monthly paid amounts for last 6 months
    const monthlyChart = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('en', { month: 'short' });
      const paid = invoices
        .filter(inv => inv.status === 'Paid' && inv.paid_date && inv.paid_date.startsWith(month))
        .reduce((s, inv) => s + inv.total, 0);
      monthlyChart.push({ month: monthLabel, paid: Math.round(paid) });
    }

    const recentInvoices = invoices.slice(0, 5);
    const overdueInvoices = invoices.filter(i => i.status === 'Overdue');
    const upcomingInvoices = invoices.filter(i => i.status === 'Sent').sort((a, b) => new Date(a.due_date) - new Date(b.due_date)).slice(0, 3);

    // Payment slips submitted
    const pendingSlips = db.prepare(`SELECT * FROM payment_slips WHERE client_id=? AND status='Pending' ORDER BY submitted_at DESC`).all(clientId);

    const gw = db.prepare('SELECT enabled_gateways FROM payment_gateway_settings WHERE id=1').get();
    const enabledGateways = gw ? JSON.parse(gw.enabled_gateways || '["bank_transfer"]') : ['bank_transfer'];

    res.json({
      stats: { totalPaid, totalPending, totalOverdue, invoiceCount: invoices.length },
      recentInvoices,
      overdueInvoices,
      upcomingInvoices,
      monthlyChart,
      pendingSlips,
      enabledGateways,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Invoices ───────────────────────────────────────────────────────────────
router.get('/invoices', (req, res) => {
  try {
    const { clientId, clientEmail } = req.client;
    const { status, month } = req.query;
    let query = `SELECT i.*, GROUP_CONCAT(ii.description || '|' || ii.quantity || '|' || ii.unit_price || '|' || ii.amount, ';;') as items_raw FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id = i.id WHERE ${clientInvoiceWhere()} AND i.status!='Draft'`;
    const params = [clientId, clientEmail || ''];
    if (status) { query += ' AND i.status=?'; params.push(status); }
    if (month) { query += ' AND strftime(\'%Y-%m\', i.issue_date)=?'; params.push(month); }
    query += ' GROUP BY i.id ORDER BY i.created_at DESC';
    const rows = db.prepare(query).all(...params);
    const invoices = rows.map(inv => ({
      ...inv,
      items: inv.items_raw ? inv.items_raw.split(';;').map(item => {
        const [description, quantity, unit_price, amount] = item.split('|');
        return { description, quantity: parseFloat(quantity), unit_price: parseFloat(unit_price), amount: parseFloat(amount) };
      }) : []
    }));
    res.json(invoices);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Invoice detail ─────────────────────────────────────────────────────────
router.get('/invoices/:id', (req, res) => {
  try {
    const { clientId, clientEmail } = req.client;
    const inv = db.prepare(`SELECT * FROM invoices WHERE id=? AND ${clientInvoiceWhere('')}`).get(req.params.id, clientId, clientEmail || '');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id=?`).all(inv.id);
    res.json({ ...inv, items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Invoice PDF download ───────────────────────────────────────────────────
router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const { clientId, clientEmail } = req.client;
    const inv = db.prepare(`SELECT * FROM invoices WHERE id=? AND ${clientInvoiceWhere('')}`).get(req.params.id, clientId, clientEmail || '');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    const items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id=?`).all(inv.id);
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const pdfPath = await generateInvoicePDF({ ...inv, items }, settings);
    res.download(pdfPath, `Invoice-${inv.invoice_number}.pdf`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Bank details ───────────────────────────────────────────────────────────
router.get('/bank-details', (req, res) => {
  try {
    const gw = db.prepare('SELECT bank_account_no, bank_account_name, bank_name, bank_swift, bank_branch, enabled_gateways, payhere_merchant_id, payhere_mode FROM payment_gateway_settings WHERE id=1').get();
    res.json(gw || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Submit payment slip ────────────────────────────────────────────────────
router.post('/payment-slips', uploadSlip.single('slip'), (req, res) => {
  try {
    const { clientId, clientName, clientEmail } = req.client;
    const { invoice_id, amount, currency, reference } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Payment slip image is required' });

    const inv = db.prepare(`SELECT * FROM invoices WHERE id=? AND ${clientInvoiceWhere('')}`).get(invoice_id, clientId, clientEmail || '');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    // Check if already has a pending slip for this invoice
    const existing = db.prepare(`SELECT id FROM payment_slips WHERE invoice_id=? AND status='Pending'`).get(invoice_id);
    if (existing) return res.status(400).json({ error: 'A payment slip is already pending review for this invoice' });

    const slipPath = `/uploads/payment-slips/${req.file.filename}`;
    const result = db.prepare(`
      INSERT INTO payment_slips (invoice_id, client_id, invoice_number, client_name, slip_path, amount, currency, reference)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(invoice_id, clientId, inv.invoice_number, clientName, slipPath, amount || inv.total, currency || inv.currency || 'LKR', reference);

    // Notify admin
    db.prepare(`INSERT INTO notifications (type, title, message, related_id, related_type) VALUES ('info','Payment Slip Submitted',?,?,?)`).run(
      `${clientName} submitted a payment slip for Invoice #${inv.invoice_number} (${inv.currency_symbol || 'Rs.'} ${inv.total})`,
      result.lastInsertRowid, 'payment_slip'
    );

    res.json({ id: result.lastInsertRowid, message: 'Payment slip submitted successfully. Awaiting admin approval.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Client's payment slips ─────────────────────────────────────────────────
router.get('/payment-slips', (req, res) => {
  try {
    const slips = db.prepare(`SELECT * FROM payment_slips WHERE client_id=? ORDER BY submitted_at DESC`).all(req.client.clientId);
    res.json(slips);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PayHere: initiate payment ──────────────────────────────────────────────
router.post('/payment/payhere/initiate', (req, res) => {
  try {
    const { clientId, clientName, clientEmail } = req.client;
    const { invoice_id } = req.body;

    const inv = db.prepare(`SELECT * FROM invoices WHERE id=? AND ${clientInvoiceWhere('')}`).get(invoice_id, clientId, clientEmail || '');
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'Paid') return res.status(400).json({ error: 'Invoice is already paid' });

    const gw = db.prepare('SELECT * FROM payment_gateway_settings WHERE id=1').get();
    if (!gw?.payhere_merchant_id) return res.status(400).json({ error: 'PayHere is not configured' });

    const orderId = `ORD-${inv.invoice_number}-${Date.now()}`;
    const amount = inv.total.toFixed(2);
    const currency = inv.currency || 'LKR';

    // MD5 hash: merchant_id + order_id + amount + currency + MD5(secret).toUpperCase()
    const secretHash = crypto.createHash('md5').update(gw.payhere_secret).digest('hex').toUpperCase();
    const hashStr = `${gw.payhere_merchant_id}${orderId}${amount}${currency}${secretHash}`;
    const hash = crypto.createHash('md5').update(hashStr).digest('hex');

    // Store pending payment
    db.prepare(`INSERT INTO online_payments (invoice_id, client_id, invoice_number, gateway, gateway_order_id, amount, currency, status) VALUES (?,?,?,?,?,?,?,?)`).run(
      inv.id, clientId, inv.invoice_number, 'payhere', orderId, inv.total, currency, 'Pending'
    );

    const isLive = gw.payhere_mode === 'live';
    const actionUrl = isLive
      ? 'https://www.payhere.lk/pay/checkout'
      : 'https://sandbox.payhere.lk/pay/checkout';

    // Get client details
    const client = db.prepare('SELECT * FROM clients WHERE id=?').get(clientId);
    const nameParts = (clientName || '').split(' ');

    res.json({
      actionUrl,
      params: {
        merchant_id: gw.payhere_merchant_id,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/pay-result?status=success`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/pay/${inv.id}?cancelled=1`,
        notify_url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/portal/payment/payhere/notify`,
        order_id: orderId,
        items: `Invoice #${inv.invoice_number}`,
        currency,
        amount,
        first_name: nameParts[0] || clientName,
        last_name: nameParts.slice(1).join(' ') || '',
        email: clientEmail || client?.email || '',
        phone: client?.phone || '',
        address: client?.address || '',
        city: 'Colombo',
        country: client?.country || 'Sri Lanka',
        hash,
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PayHere: notify webhook (NO auth — called by PayHere server) ───────────
router.post('/payment/payhere/notify', express.urlencoded({ extended: true }), (req, res) => {
  try {
    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig, payment_id } = req.body;
    const gw = db.prepare('SELECT * FROM payment_gateway_settings WHERE id=1').get();
    if (!gw) return res.sendStatus(400);

    // Verify signature
    const secretHash = crypto.createHash('md5').update(gw.payhere_secret).digest('hex').toUpperCase();
    const expected = crypto.createHash('md5')
      .update(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`)
      .digest('hex');

    if (expected.toLowerCase() !== md5sig?.toLowerCase()) return res.sendStatus(400);

    const op = db.prepare(`SELECT * FROM online_payments WHERE gateway_order_id=?`).get(order_id);
    if (!op) return res.sendStatus(404);

    if (status_code === '2') { // Success
      db.prepare(`UPDATE online_payments SET status='Completed', gateway_payment_id=? WHERE gateway_order_id=?`).run(payment_id, order_id);
      const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(op.invoice_id);
      if (inv && inv.status !== 'Paid') {
        db.prepare(`UPDATE invoices SET status='Paid', paid_date=date('now') WHERE id=?`).run(inv.id);
        // Auto-record revenue
        const existing = db.prepare(`SELECT id FROM revenue WHERE invoice_number=?`).get(inv.invoice_number);
        if (existing) {
          db.prepare(`UPDATE revenue SET payment_status='Paid', invoice_date=date('now') WHERE invoice_number=?`).run(inv.invoice_number);
        } else {
          db.prepare(`INSERT INTO revenue (client_name, invoice_number, invoice_date, amount, payment_status, currency, payment_method, auto_recorded, notes) VALUES (?,?,date('now'),?,'Paid',?,'PayHere',1,?)`).run(
            inv.client_name, inv.invoice_number, inv.total, inv.currency || 'LKR', `Auto-recorded via PayHere (Order: ${order_id})`
          );
        }
        db.prepare(`INSERT INTO notifications (type,title,message) VALUES ('success','PayHere Payment Received',?)`).run(
          `Payment received for Invoice #${inv.invoice_number} via PayHere (Rs. ${inv.total})`
        );
      }
    } else if (status_code === '0') {
      db.prepare(`UPDATE online_payments SET status='Pending' WHERE gateway_order_id=?`).run(order_id);
    } else {
      db.prepare(`UPDATE online_payments SET status='Failed' WHERE gateway_order_id=?`).run(order_id);
    }

    res.sendStatus(200);
  } catch (err) { console.error('PayHere notify error:', err); res.sendStatus(500); }
});

module.exports = router;
