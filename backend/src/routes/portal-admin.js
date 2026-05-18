const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');

router.get('/credentials', (req, res) => {
  try {
    const cid = req.companyId;
    const rows = db.prepare(`
      SELECT cc.id, cc.client_id, cc.username, cc.is_active, cc.last_login, cc.created_at,
             c.name as client_name, c.email as client_email, c.company as client_company
      FROM client_credentials cc
      JOIN clients c ON c.id = cc.client_id AND c.company_id=cc.company_id
      WHERE cc.company_id=?
      ORDER BY cc.created_at DESC
    `).all(cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/credentials', (req, res) => {
  try {
    const cid = req.companyId;
    const { client_id, username, password } = req.body;
    if (!client_id || !username || !password) return res.status(400).json({ error: 'client_id, username, and password are required' });

    const client = db.prepare('SELECT * FROM clients WHERE id=? AND company_id=?').get(client_id, cid);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const existing = db.prepare('SELECT id FROM client_credentials WHERE company_id=? AND client_id=?').get(cid, client_id);
    if (existing) return res.status(400).json({ error: 'This client already has portal access. Use update to reset password.' });

    const usernameTaken = db.prepare('SELECT id FROM client_credentials WHERE company_id=? AND username=?').get(cid, username);
    if (usernameTaken) return res.status(400).json({ error: 'Username already taken' });

    const password_hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(`INSERT INTO client_credentials (client_id, username, password_hash, company_id) VALUES (?,?,?,?)`).run(client_id, username, password_hash, cid);

    db.prepare(`INSERT INTO notifications (type, title, message, company_id) VALUES ('info','Portal Access Created',?,?)`).run(
      `Portal access created for ${client.name} (username: ${username})`,
      cid
    );

    res.json({ id: result.lastInsertRowid, message: 'Portal access created' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/credentials/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const { password, is_active } = req.body;
    const cred = db.prepare('SELECT cc.* FROM client_credentials cc WHERE cc.id=? AND cc.company_id=?').get(req.params.id, cid);
    if (!cred) return res.status(404).json({ error: 'Credential not found' });

    if (password !== undefined && password !== '') {
      const password_hash = bcrypt.hashSync(password, 12);
      db.prepare(`UPDATE client_credentials SET password_hash=? WHERE id=? AND company_id=?`).run(password_hash, req.params.id, cid);
    }
    if (is_active !== undefined) {
      db.prepare(`UPDATE client_credentials SET is_active=? WHERE id=? AND company_id=?`).run(is_active ? 1 : 0, req.params.id, cid);
    }
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/credentials/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM client_credentials WHERE id=? AND company_id=?').run(req.params.id, req.companyId);
    if (!r.changes) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Portal access revoked' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/clients-without-access', (req, res) => {
  try {
    const cid = req.companyId;
    const rows = db.prepare(`
      SELECT c.id, c.name, c.email, c.company
      FROM clients c
      WHERE c.company_id=? AND c.id NOT IN (SELECT client_id FROM client_credentials WHERE company_id=?)
      ORDER BY c.name ASC
    `).all(cid, cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/payment-slips', (req, res) => {
  try {
    const cid = req.companyId;
    const { status } = req.query;
    let query = `SELECT ps.*, i.total as invoice_total, i.currency_symbol FROM payment_slips ps LEFT JOIN invoices i ON i.id = ps.invoice_id AND i.company_id=ps.company_id WHERE ps.company_id=?`;
    const params = [cid];
    if (status) { query += ' AND ps.status=?'; params.push(status); }
    query += ' ORDER BY ps.submitted_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/payment-slips/:id', (req, res) => {
  try {
    const cid = req.companyId;
    const { action, admin_notes } = req.body;
    const slip = db.prepare('SELECT * FROM payment_slips WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!slip) return res.status(404).json({ error: 'Slip not found' });

    const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
    db.prepare(`UPDATE payment_slips SET status=?, reviewed_at=CURRENT_TIMESTAMP, admin_notes=? WHERE id=? AND company_id=?`).run(newStatus, admin_notes || null, slip.id, cid);

    if (action === 'approve') {
      const inv = db.prepare('SELECT * FROM invoices WHERE id=? AND company_id=?').get(slip.invoice_id, cid);
      if (inv && inv.status !== 'Paid') {
        db.prepare(`UPDATE invoices SET status='Paid', paid_date=date('now') WHERE id=? AND company_id=?`).run(inv.id, cid);
        const existing = db.prepare(`SELECT id FROM revenue WHERE company_id=? AND invoice_number=?`).get(cid, inv.invoice_number);
        if (existing) {
          db.prepare(`UPDATE revenue SET payment_status='Paid', invoice_date=date('now') WHERE id=? AND company_id=?`).run(existing.id, cid);
        } else {
          db.prepare(`INSERT INTO revenue (client_name, invoice_number, invoice_date, amount, payment_status, currency, payment_method, auto_recorded, notes, company_id) VALUES (?,?,date('now'),?,'Paid',?,'Bank Transfer',1,?,?)`).run(
            inv.client_name, inv.invoice_number, inv.total, inv.currency || 'LKR', `Auto-recorded: payment slip approved for Invoice #${inv.invoice_number}`, cid
          );
        }
      }
      db.prepare(`INSERT INTO notifications (type,title,message,company_id) VALUES ('success','Payment Approved',?,?)`).run(
        `Bank transfer slip approved for Invoice #${slip.invoice_number} from ${slip.client_name}`,
        cid
      );
    } else {
      db.prepare(`INSERT INTO notifications (type,title,message,company_id) VALUES ('warning','Payment Slip Rejected',?,?)`).run(
        `Bank transfer slip rejected for Invoice #${slip.invoice_number} from ${slip.client_name}${admin_notes ? ': ' + admin_notes : ''}`,
        cid
      );
    }

    res.json({ message: `Slip ${newStatus.toLowerCase()}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/gateway', (req, res) => {
  try {
    const gw = db.prepare('SELECT * FROM payment_gateway_settings WHERE company_id=? LIMIT 1').get(req.companyId);
    res.json(gw || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/gateway', (req, res) => {
  try {
    const cid = req.companyId;
    const { payhere_merchant_id, payhere_secret, payhere_mode, bank_account_no, bank_account_name, bank_name, bank_swift, bank_branch, enabled_gateways } = req.body;
    const r = db.prepare(`
      UPDATE payment_gateway_settings SET
        payhere_merchant_id=?, payhere_secret=?, payhere_mode=?,
        bank_account_no=?, bank_account_name=?, bank_name=?, bank_swift=?, bank_branch=?,
        enabled_gateways=?, updated_at=CURRENT_TIMESTAMP
      WHERE company_id=?
    `).run(
      payhere_merchant_id || '', payhere_secret || '', payhere_mode || 'sandbox',
      bank_account_no || '102005870825', bank_account_name || 'Groovymark (pvt) Ltd',
      bank_name || 'DFCC Bank Gampaha', bank_swift || 'DFCCLKLX', bank_branch || 'Gampaha',
      JSON.stringify(enabled_gateways || ['bank_transfer']),
      cid
    );
    if (!r.changes) return res.status(404).json({ error: 'Gateway row not found' });
    res.json({ message: 'Payment gateway settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/online-payments', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM online_payments WHERE company_id=? ORDER BY created_at DESC LIMIT 100`).all(req.companyId);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
