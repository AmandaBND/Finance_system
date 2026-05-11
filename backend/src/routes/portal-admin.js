const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');

// ── Client Credentials ─────────────────────────────────────────────────────

// GET all credentials with client info
router.get('/credentials', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT cc.id, cc.client_id, cc.username, cc.is_active, cc.last_login, cc.created_at,
             c.name as client_name, c.email as client_email, c.company as client_company
      FROM client_credentials cc
      JOIN clients c ON c.id = cc.client_id
      ORDER BY cc.created_at DESC
    `).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create credentials for a client
router.post('/credentials', (req, res) => {
  try {
    const { client_id, username, password } = req.body;
    if (!client_id || !username || !password) return res.status(400).json({ error: 'client_id, username, and password are required' });

    const client = db.prepare('SELECT * FROM clients WHERE id=?').get(client_id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const existing = db.prepare('SELECT id FROM client_credentials WHERE client_id=?').get(client_id);
    if (existing) return res.status(400).json({ error: 'This client already has portal access. Use update to reset password.' });

    const usernameTaken = db.prepare('SELECT id FROM client_credentials WHERE username=?').get(username);
    if (usernameTaken) return res.status(400).json({ error: 'Username already taken' });

    const password_hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(`INSERT INTO client_credentials (client_id, username, password_hash) VALUES (?,?,?)`).run(client_id, username, password_hash);

    db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('info','Portal Access Created',?)`).run(
      `Portal access created for ${client.name} (username: ${username})`
    );

    res.json({ id: result.lastInsertRowid, message: 'Portal access created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update credentials (reset password / toggle active)
router.put('/credentials/:id', (req, res) => {
  try {
    const { password, is_active } = req.body;
    const cred = db.prepare('SELECT * FROM client_credentials WHERE id=?').get(req.params.id);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    if (password !== undefined && password !== '') {
      const password_hash = bcrypt.hashSync(password, 12);
      db.prepare(`UPDATE client_credentials SET password_hash=? WHERE id=?`).run(password_hash, req.params.id);
    }
    if (is_active !== undefined) {
      db.prepare(`UPDATE client_credentials SET is_active=? WHERE id=?`).run(is_active ? 1 : 0, req.params.id);
    }
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE revoke access
router.delete('/credentials/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM client_credentials WHERE id=?').run(req.params.id);
    res.json({ message: 'Portal access revoked' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET clients without portal access (for "create access" dropdown)
router.get('/clients-without-access', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.id, c.name, c.email, c.company
      FROM clients c
      WHERE c.id NOT IN (SELECT client_id FROM client_credentials)
      ORDER BY c.name ASC
    `).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Payment Slips ──────────────────────────────────────────────────────────

// GET all slips with optional status filter
router.get('/payment-slips', (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT ps.*, i.total as invoice_total, i.currency_symbol FROM payment_slips ps LEFT JOIN invoices i ON i.id = ps.invoice_id WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND ps.status=?'; params.push(status); }
    query += ' ORDER BY ps.submitted_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT approve or reject a payment slip
router.put('/payment-slips/:id', (req, res) => {
  try {
    const { action, admin_notes } = req.body; // action: 'approve' | 'reject'
    const slip = db.prepare('SELECT * FROM payment_slips WHERE id=?').get(req.params.id);
    if (!slip) return res.status(404).json({ error: 'Slip not found' });

    const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
    db.prepare(`UPDATE payment_slips SET status=?, reviewed_at=CURRENT_TIMESTAMP, admin_notes=? WHERE id=?`).run(newStatus, admin_notes || null, slip.id);

    if (action === 'approve') {
      const inv = db.prepare('SELECT * FROM invoices WHERE id=?').get(slip.invoice_id);
      if (inv && inv.status !== 'Paid') {
        db.prepare(`UPDATE invoices SET status='Paid', paid_date=date('now') WHERE id=?`).run(inv.id);
        const existing = db.prepare(`SELECT id FROM revenue WHERE invoice_number=?`).get(inv.invoice_number);
        if (existing) {
          db.prepare(`UPDATE revenue SET payment_status='Paid', invoice_date=date('now') WHERE invoice_number=?`).run(inv.invoice_number);
        } else {
          db.prepare(`INSERT INTO revenue (client_name, invoice_number, invoice_date, amount, payment_status, currency, payment_method, auto_recorded, notes) VALUES (?,?,date('now'),?,'Paid',?,'Bank Transfer',1,?)`).run(
            inv.client_name, inv.invoice_number, inv.total, inv.currency || 'LKR', `Auto-recorded: payment slip approved for Invoice #${inv.invoice_number}`
          );
        }
      }
      db.prepare(`INSERT INTO notifications (type,title,message) VALUES ('success','Payment Approved',?)`).run(
        `Bank transfer slip approved for Invoice #${slip.invoice_number} from ${slip.client_name}`
      );
    } else {
      db.prepare(`INSERT INTO notifications (type,title,message) VALUES ('warning','Payment Slip Rejected',?)`).run(
        `Bank transfer slip rejected for Invoice #${slip.invoice_number} from ${slip.client_name}${admin_notes ? ': ' + admin_notes : ''}`
      );
    }

    res.json({ message: `Slip ${newStatus.toLowerCase()}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Payment Gateway Settings ───────────────────────────────────────────────

router.get('/gateway', (req, res) => {
  try {
    const gw = db.prepare('SELECT * FROM payment_gateway_settings WHERE id=1').get();
    res.json(gw || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/gateway', (req, res) => {
  try {
    const { payhere_merchant_id, payhere_secret, payhere_mode, bank_account_no, bank_account_name, bank_name, bank_swift, bank_branch, enabled_gateways } = req.body;
    db.prepare(`
      UPDATE payment_gateway_settings SET
        payhere_merchant_id=?, payhere_secret=?, payhere_mode=?,
        bank_account_no=?, bank_account_name=?, bank_name=?, bank_swift=?, bank_branch=?,
        enabled_gateways=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=1
    `).run(
      payhere_merchant_id || '', payhere_secret || '', payhere_mode || 'sandbox',
      bank_account_no || '102005870825', bank_account_name || 'Groovymark (pvt) Ltd',
      bank_name || 'DFCC Bank Gampaha', bank_swift || 'DFCCLKLX', bank_branch || 'Gampaha',
      JSON.stringify(enabled_gateways || ['bank_transfer'])
    );
    res.json({ message: 'Payment gateway settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Online Payments Log ────────────────────────────────────────────────────
router.get('/online-payments', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM online_payments ORDER BY created_at DESC LIMIT 100`).all();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
