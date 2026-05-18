const cron = require('node-cron');
const db = require('../database');
const { sendPaymentReminderEmail, sendRecurringReminderEmail } = require('./emailService');
const { refreshRates } = require('./currencyService');
const { format, addDays } = require('date-fns');

console.log('⏰ Scheduler initialized');

// Every 4 hours: refresh live exchange rates
cron.schedule('0 */4 * * *', async () => {
  try {
    await refreshRates();
  } catch (err) { console.error('Scheduled rate refresh failed:', err.message); }
});

// Every hour: check & update overdue invoices
cron.schedule('0 * * * *', () => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const companies = db.prepare('SELECT id FROM companies').all();
    let total = 0;
    for (const { id } of companies) {
      const updated = db.prepare(`
        UPDATE invoices SET status='Overdue', updated_at=CURRENT_TIMESTAMP
        WHERE status='Sent' AND due_date IS NOT NULL AND due_date < ? AND company_id=?
      `).run(today, id);
      if (updated.changes > 0) {
        total += updated.changes;
        try {
          db.prepare(`INSERT INTO notifications (type, title, message, company_id) VALUES ('warning', 'Overdue Invoices', ?, ?)`).run(
            `${updated.changes} invoice(s) marked as overdue`,
            id
          );
        } catch (_) {}
      }
    }
    if (total > 0) console.log(`⚠️  ${total} invoices marked overdue (all tenants)`);
  } catch (err) { console.error('Overdue check error:', err); }
});

// Daily at 9 AM: send invoice payment reminders (per company settings)
cron.schedule('0 9 * * *', async () => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const companies = db.prepare('SELECT id FROM companies').all();
    for (const { id: companyId } of companies) {
      const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(companyId);
      if (!settings?.auto_send_reminders) continue;

      const reminderDays = settings.reminder_days_before || 3;
      const targetDate = format(addDays(new Date(), reminderDays), 'yyyy-MM-dd');

      const upcoming = db.prepare(`SELECT * FROM invoices WHERE company_id=? AND status='Sent' AND due_date = ? AND client_email IS NOT NULL AND client_email != ''`).all(companyId, targetDate);
      for (const inv of upcoming) {
        try {
          await sendPaymentReminderEmail(inv, settings);
          db.prepare(`UPDATE invoices SET reminder_count=reminder_count+1, last_reminder_at=CURRENT_TIMESTAMP WHERE id=?`).run(inv.id);
          db.prepare(`INSERT INTO notifications (type, title, message, company_id) VALUES ('info', 'Reminder Sent', ?, ?)`).run(
            `Payment reminder sent to ${inv.client_name} for invoice ${inv.invoice_number}`,
            companyId
          );
          console.log(`📧 Reminder sent: ${inv.invoice_number} to ${inv.client_email}`);
        } catch (e) { console.error(`Reminder error for ${inv.invoice_number}:`, e.message); }
      }

      const overdue = db.prepare(`SELECT * FROM invoices WHERE company_id=? AND status='Overdue' AND client_email IS NOT NULL AND client_email != '' AND (last_reminder_at IS NULL OR datetime(last_reminder_at, '+3 days') <= datetime('now'))`).all(companyId);
      for (const inv of overdue) {
        try {
          await sendPaymentReminderEmail(inv, settings);
          db.prepare(`UPDATE invoices SET reminder_count=reminder_count+1, last_reminder_at=CURRENT_TIMESTAMP WHERE id=?`).run(inv.id);
          console.log(`⚠️  Overdue reminder sent: ${inv.invoice_number}`);
        } catch (e) { console.error(`Overdue reminder error:`, e.message); }
      }
    }
  } catch (err) { console.error('Daily reminder error:', err); }
});

// Daily at 9 AM: send recurring payment reminders
cron.schedule('0 9 * * *', async () => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    const companies = db.prepare('SELECT id FROM companies').all();
    for (const { id: companyId } of companies) {
      const settings = db.prepare('SELECT * FROM settings WHERE company_id=? LIMIT 1').get(companyId);
      if (!settings) continue;

      const recurring = db.prepare(`
        SELECT * FROM recurring_payments
        WHERE company_id=? AND status='Active'
        AND (last_reminder_sent IS NULL OR last_reminder_sent < date('now', '-1 day'))
        AND next_payment_date BETWEEN date('now') AND date('now', '+' || COALESCE(reminder_days, 3) || ' days')
      `).all(companyId);

      for (const rp of recurring) {
        try {
          if (rp.email) {
            await sendRecurringReminderEmail(rp, settings);
            db.prepare(`UPDATE recurring_payments SET last_reminder_sent=? WHERE id=?`).run(today, rp.id);
            db.prepare(`INSERT INTO notifications (type, title, message, company_id) VALUES ('info', 'Recurring Reminder', ?, ?)`).run(
              `Reminder sent for ${rp.name} due on ${rp.next_payment_date}`,
              companyId
            );
            console.log(`📧 Recurring reminder: ${rp.name}`);
          }
          db.prepare(`INSERT INTO notifications (type, title, message, company_id) VALUES ('info', 'Upcoming Payment', ?, ?)`).run(
            `${rp.name} (${rp.type}) due on ${rp.next_payment_date} - Rs. ${rp.amount}`,
            companyId
          );
        } catch (e) { console.error(`Recurring reminder error for ${rp.name}:`, e.message); }
      }
    }
  } catch (err) { console.error('Recurring reminder error:', err); }
});

// Weekly Sunday at 10 AM: refresh AI insights (per company)
cron.schedule('0 10 * * 0', async () => {
  try {
    console.log('🤖 Refreshing AI insights...');
    const { generateInsights } = require('./aiService');
    const companies = db.prepare('SELECT id FROM companies').all();
    for (const { id } of companies) {
      try { await generateInsights(true, id); } catch (e) { console.error('AI refresh company', id, e.message); }
    }
    console.log('✅ AI insights refreshed');
  } catch (err) { console.error('AI refresh error:', err); }
});

// Daily midnight: mark overdue tasks
cron.schedule('0 0 * * *', () => {
  try {
    const result = db.prepare(`
      UPDATE tasks SET status='overdue'
      WHERE status NOT IN ('completed','overdue','cancelled')
      AND due_date IS NOT NULL AND due_date < date('now')
    `).run();
    if (result.changes > 0) {
      console.log(`⚠️  ${result.changes} task(s) marked overdue`);
    }
  } catch (err) { console.error('Task overdue check error:', err); }
});

// Daily midnight: check low cash balance alert (per company)
cron.schedule('0 0 * * *', () => {
  try {
    const companies = db.prepare('SELECT id FROM companies').all();
    for (const { id: companyId } of companies) {
      const totalReceived = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM revenue WHERE company_id=? AND payment_status='Paid'`).get(companyId).t;
      const totalSpent = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE company_id=?`).get(companyId).t;
      const totalSalaries = db.prepare(`SELECT COALESCE(SUM(net_salary),0) as t FROM salary_payments WHERE company_id=? AND status='Paid'`).get(companyId).t;
      const cashBalance = totalReceived - totalSpent - totalSalaries;
      const monthlyBurn = db.prepare(`SELECT COALESCE(SUM(amount),0)/3 as avg FROM expenses WHERE company_id=? AND payment_date >= date('now', '-90 days')`).get(companyId).avg;
      if (cashBalance < monthlyBurn && monthlyBurn > 0) {
        db.prepare(`INSERT INTO notifications (type, title, message, company_id) VALUES ('critical', 'Low Cash Balance', ?, ?)`).run(
          `Cash balance (Rs. ${Math.round(cashBalance).toLocaleString()}) is below 1 month of expenses`,
          companyId
        );
      }
    }
  } catch (err) { console.error('Cash balance check error:', err); }
});

module.exports = {};
