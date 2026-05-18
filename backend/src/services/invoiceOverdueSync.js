const db = require('../database');
const { format } = require('date-fns');

/**
 * Mark Sent invoices as Overdue when due_date is before calendar today.
 * @param {string|null} companyId If set, only that tenant; if null, all tenants (scheduler).
 */
function syncOverdueInvoices(companyId = null) {
  const today = format(new Date(), 'yyyy-MM-dd');
  if (companyId) {
    return db.prepare(`
      UPDATE invoices
      SET status='Overdue', updated_at=CURRENT_TIMESTAMP
      WHERE status='Sent' AND due_date IS NOT NULL AND due_date < ? AND company_id=?
    `).run(today, companyId);
  }
  return db.prepare(`
    UPDATE invoices
    SET status='Overdue', updated_at=CURRENT_TIMESTAMP
    WHERE status='Sent' AND due_date IS NOT NULL AND due_date < ?
  `).run(today);
}

module.exports = { syncOverdueInvoices };
