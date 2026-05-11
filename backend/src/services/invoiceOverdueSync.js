const db = require('../database');
const { format } = require('date-fns');

/**
 * Mark Sent invoices as Overdue when due_date is before calendar today (server TZ).
 * Returns the sqlite run result (changes count). Idempotent — safe to call often.
 */
function syncOverdueInvoices() {
  const today = format(new Date(), 'yyyy-MM-dd');
  return db.prepare(`
    UPDATE invoices
    SET status='Overdue', updated_at=CURRENT_TIMESTAMP
    WHERE status='Sent' AND due_date IS NOT NULL AND due_date < ?
  `).run(today);
}

module.exports = { syncOverdueInvoices };
