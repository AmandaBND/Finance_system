const cron = require('node-cron');
const db = require('../database');
const { sendPaymentReminderEmail, sendRecurringReminderEmail } = require('./emailService');
const { refreshRates } = require('./currencyService');
const { syncOverdueInvoices } = require('./invoiceOverdueSync');
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
    const updated = syncOverdueInvoices();
    if (updated.changes > 0) {
      db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('warning', 'Overdue Invoices', ?)`).run(`${updated.changes} invoice(s) marked as overdue`);
      console.log(`⚠️  ${updated.changes} invoices marked overdue`);
    }
  } catch (err) { console.error('Overdue check error:', err); }
});

// Daily at 9 AM: send invoice payment reminders
cron.schedule('0 9 * * *', async () => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    if (!settings?.auto_send_reminders) return;

    const reminderDays = settings.reminder_days_before || 3;
    const today = format(new Date(), 'yyyy-MM-dd');
    const targetDate = format(addDays(new Date(), reminderDays), 'yyyy-MM-dd');

    // Invoices due in reminder_days_before days
    const upcoming = db.prepare(`SELECT * FROM invoices WHERE status='Sent' AND due_date = ? AND client_email IS NOT NULL AND client_email != ''`).all(targetDate);
    for (const inv of upcoming) {
      try {
        await sendPaymentReminderEmail(inv, settings);
        db.prepare(`UPDATE invoices SET reminder_count=reminder_count+1, last_reminder_at=CURRENT_TIMESTAMP WHERE id=?`).run(inv.id);
        db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('info', 'Reminder Sent', ?)`).run(`Payment reminder sent to ${inv.client_name} for invoice ${inv.invoice_number}`);
        console.log(`📧 Reminder sent: ${inv.invoice_number} to ${inv.client_email}`);
      } catch (e) { console.error(`Reminder error for ${inv.invoice_number}:`, e.message); }
    }

    // Overdue invoice reminders (resend every 3 days)
    const overdue = db.prepare(`SELECT * FROM invoices WHERE status='Overdue' AND client_email IS NOT NULL AND client_email != '' AND (last_reminder_at IS NULL OR datetime(last_reminder_at, '+3 days') <= datetime('now'))`).all();
    for (const inv of overdue) {
      try {
        await sendPaymentReminderEmail(inv, settings);
        db.prepare(`UPDATE invoices SET reminder_count=reminder_count+1, last_reminder_at=CURRENT_TIMESTAMP WHERE id=?`).run(inv.id);
        console.log(`⚠️  Overdue reminder sent: ${inv.invoice_number}`);
      } catch (e) { console.error(`Overdue reminder error:`, e.message); }
    }
  } catch (err) { console.error('Daily reminder error:', err); }
});

// Daily at 9 AM: send recurring payment reminders
cron.schedule('0 9 * * *', async () => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id=1').get();
    const today = format(new Date(), 'yyyy-MM-dd');

    const recurring = db.prepare(`
      SELECT * FROM recurring_payments
      WHERE status='Active'
      AND (last_reminder_sent IS NULL OR last_reminder_sent < date('now', '-1 day'))
      AND next_payment_date BETWEEN date('now') AND date('now', '+' || COALESCE(reminder_days, 3) || ' days')
    `).all();

    for (const rp of recurring) {
      try {
        if (rp.email) {
          await sendRecurringReminderEmail(rp, settings);
          db.prepare(`UPDATE recurring_payments SET last_reminder_sent=? WHERE id=?`).run(today, rp.id);
          db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('info', 'Recurring Reminder', ?)`).run(`Reminder sent for ${rp.name} due on ${rp.next_payment_date}`);
          console.log(`📧 Recurring reminder: ${rp.name}`);
        }
        // Internal notification regardless
        db.prepare(`INSERT OR IGNORE INTO notifications (type, title, message) VALUES ('info', 'Upcoming Payment', ?)`).run(`${rp.name} (${rp.type}) due on ${rp.next_payment_date} - Rs. ${rp.amount}`);
      } catch (e) { console.error(`Recurring reminder error for ${rp.name}:`, e.message); }
    }
  } catch (err) { console.error('Recurring reminder error:', err); }
});

// Weekly Sunday at 10 AM: refresh AI insights
cron.schedule('0 10 * * 0', async () => {
  try {
    console.log('🤖 Refreshing AI insights...');
    const { generateInsights } = require('./aiService');
    await generateInsights(true);
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

// Daily midnight: check low cash balance alert
cron.schedule('0 0 * * *', () => {
  try {
    const totalReceived = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM revenue WHERE payment_status='Paid'`).get().t;
    const totalSpent = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM expenses`).get().t;
    const totalSalaries = db.prepare(`SELECT COALESCE(SUM(net_salary),0) as t FROM salary_payments WHERE status='Paid'`).get().t;
    const cashBalance = totalReceived - totalSpent - totalSalaries;

    // Alert if cash balance is low (less than 1 month of expenses)
    const monthlyBurn = db.prepare(`SELECT COALESCE(SUM(amount),0)/3 as avg FROM expenses WHERE payment_date >= date('now', '-90 days')`).get().avg;
    if (cashBalance < monthlyBurn && monthlyBurn > 0) {
      db.prepare(`INSERT INTO notifications (type, title, message) VALUES ('critical', 'Low Cash Balance', ?)`).run(`Cash balance (Rs. ${Math.round(cashBalance).toLocaleString()}) is below 1 month of expenses`);
    }
  } catch (err) { console.error('Cash balance check error:', err); }
});

module.exports = {};
