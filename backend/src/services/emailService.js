const nodemailer = require('nodemailer');
const db = require('../database');
const fs = require('fs');

function getTransporter(settings) {
  return nodemailer.createTransport({
    host: settings.smtp_host || process.env.SMTP_HOST,
    port: parseInt(settings.smtp_port || process.env.SMTP_PORT || 465),
    secure: settings.smtp_secure !== 0,
    auth: {
      user: settings.smtp_user || process.env.SMTP_USER,
      pass: settings.smtp_pass || process.env.SMTP_PASS
    },
    tls: { rejectUnauthorized: false }
  });
}

function formatCurrency(amount, symbol = 'Rs.') {
  return `${symbol} ${Number(amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}

async function sendInvoiceEmail(invoice, pdfPath, settings) {
  const transporter = getTransporter(settings);
  const symbol = settings.currency_symbol || 'Rs.';
  const companyName = settings.company_name || 'GroovyMark';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin:0; padding:0; background:#f4f6f9; color:#333; }
    .container { max-width:600px; margin:30px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#6366f1,#4f46e5); padding:32px; color:#fff; text-align:center; }
    .header h1 { margin:0; font-size:28px; font-weight:700; }
    .header p { margin:8px 0 0; opacity:0.85; font-size:14px; }
    .body { padding:32px; }
    .greeting { font-size:16px; margin-bottom:16px; }
    .invoice-box { background:#f8f9ff; border:1px solid #e0e3ff; border-radius:8px; padding:20px; margin:20px 0; }
    .invoice-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; font-size:14px; }
    .invoice-row:last-child { border-bottom:none; font-weight:700; font-size:16px; color:#6366f1; }
    .btn { display:inline-block; background:#6366f1; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; margin:20px 0; }
    .footer { background:#f8f9ff; padding:20px 32px; text-align:center; font-size:12px; color:#888; border-top:1px solid #eee; }
    .status-badge { display:inline-block; background:#fef3c7; color:#92400e; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
  </style></head>
  <body>
  <div class="container">
    <div class="header">
      <h1>${companyName}</h1>
      <p>Invoice #${invoice.invoice_number}</p>
    </div>
    <div class="body">
      <p class="greeting">Dear ${invoice.client_name},</p>
      <p>Please find attached invoice <strong>#${invoice.invoice_number}</strong> for services rendered.</p>
      <div class="invoice-box">
        <div class="invoice-row"><span>Invoice Number</span><span>${invoice.invoice_number}</span></div>
        <div class="invoice-row"><span>Issue Date</span><span>${invoice.issue_date}</span></div>
        <div class="invoice-row"><span>Due Date</span><span>${invoice.due_date}</span></div>
        <div class="invoice-row"><span>Total Amount</span><span>${formatCurrency(invoice.total, symbol)}</span></div>
      </div>
      <p>Please process this payment by <strong>${invoice.due_date}</strong>.</p>
      ${invoice.notes ? `<p><em>${invoice.notes}</em></p>` : ''}
      ${invoice.terms ? `<p><small>${invoice.terms}</small></p>` : ''}
      <p>If you have any questions, please contact us at <a href="mailto:${settings.company_email}">${settings.company_email}</a></p>
    </div>
    <div class="footer">
      <p>${companyName} &bull; ${settings.company_email || ''} &bull; ${settings.company_phone || ''}</p>
      <p>${settings.company_address || ''}</p>
    </div>
  </div>
  </body></html>
  `;

  await transporter.sendMail({
    from: `"${companyName}" <${settings.smtp_user}>`,
    to: invoice.client_email,
    subject: `Invoice #${invoice.invoice_number} from ${companyName}`,
    html,
    attachments: pdfPath ? [{ filename: `Invoice-${invoice.invoice_number}.pdf`, path: pdfPath }] : []
  });
}

async function sendPaymentReminderEmail(invoice, settings) {
  const transporter = getTransporter(settings);
  const symbol = settings.currency_symbol || 'Rs.';
  const companyName = settings.company_name || 'GroovyMark';
  const isOverdue = invoice.status === 'Overdue';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin:0; padding:0; background:#f4f6f9; }
    .container { max-width:600px; margin:30px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .header { background:${isOverdue ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#f59e0b,#d97706)'}; padding:32px; color:#fff; text-align:center; }
    .header h1 { margin:0; font-size:24px; }
    .body { padding:32px; }
    .invoice-box { background:#fef9f0; border:1px solid #fde68a; border-radius:8px; padding:20px; margin:20px 0; }
    .invoice-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #fde68a; font-size:14px; }
    .invoice-row:last-child { border-bottom:none; font-weight:700; color:#92400e; }
    .footer { background:#f8f9ff; padding:20px; text-align:center; font-size:12px; color:#888; }
  </style></head>
  <body>
  <div class="container">
    <div class="header">
      <h1>${isOverdue ? '⚠️ Payment Overdue' : '🔔 Payment Reminder'}</h1>
      <p>${companyName}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${invoice.client_name}</strong>,</p>
      <p>${isOverdue
        ? `This is a reminder that invoice <strong>#${invoice.invoice_number}</strong> is now <strong>overdue</strong>.`
        : `This is a friendly reminder that invoice <strong>#${invoice.invoice_number}</strong> is due soon.`
      }</p>
      <div class="invoice-box">
        <div class="invoice-row"><span>Invoice #</span><span>${invoice.invoice_number}</span></div>
        <div class="invoice-row"><span>Due Date</span><span>${invoice.due_date}</span></div>
        <div class="invoice-row"><span>Amount Due</span><span>${formatCurrency(invoice.total, symbol)}</span></div>
      </div>
      <p>Please arrange payment at your earliest convenience. Contact us at <a href="mailto:${settings.company_email}">${settings.company_email}</a> if you have any questions.</p>
    </div>
    <div class="footer"><p>${companyName} &bull; ${settings.company_email}</p></div>
  </div>
  </body></html>
  `;

  await transporter.sendMail({
    from: `"${companyName}" <${settings.smtp_user}>`,
    to: invoice.client_email,
    subject: `${isOverdue ? 'OVERDUE: ' : 'Reminder: '}Invoice #${invoice.invoice_number} - ${formatCurrency(invoice.total, symbol)}`,
    html
  });
}

async function sendRecurringReminderEmail(payment, settings) {
  const transporter = getTransporter(settings);
  const symbol = settings.currency_symbol || 'Rs.';
  const companyName = settings.company_name || 'GroovyMark';
  const isIncome = payment.type === 'Income';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin:0; background:#f4f6f9; }
    .container { max-width:600px; margin:30px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#6366f1,#4f46e5); padding:32px; color:#fff; text-align:center; }
    .body { padding:32px; }
    .info-box { background:#f0f4ff; border:1px solid #c7d2fe; border-radius:8px; padding:20px; margin:20px 0; }
    .row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; border-bottom:1px solid #e0e7ff; }
    .row:last-child { border-bottom:none; font-weight:700; color:#4f46e5; }
    .footer { background:#f8f9ff; padding:20px; text-align:center; font-size:12px; color:#888; }
  </style></head>
  <body>
  <div class="container">
    <div class="header">
      <h1>🔔 Upcoming ${isIncome ? 'Payment Due' : 'Expense Due'}</h1>
      <p>${companyName} - Recurring Payment Reminder</p>
    </div>
    <div class="body">
      <p>This is an automated reminder for an upcoming recurring ${isIncome ? 'payment' : 'expense'}.</p>
      <div class="info-box">
        <div class="row"><span>Name</span><span>${payment.name}</span></div>
        <div class="row"><span>Type</span><span>${payment.type}</span></div>
        <div class="row"><span>Billing Cycle</span><span>${payment.billing_cycle}</span></div>
        <div class="row"><span>Due Date</span><span>${payment.next_payment_date}</span></div>
        <div class="row"><span>Amount</span><span>${formatCurrency(payment.amount, symbol)}</span></div>
      </div>
      ${payment.notes ? `<p><em>${payment.notes}</em></p>` : ''}
    </div>
    <div class="footer"><p>${companyName} Financial System</p></div>
  </div>
  </body></html>
  `;

  await transporter.sendMail({
    from: `"${companyName} Finance" <${settings.smtp_user}>`,
    to: payment.email || settings.smtp_user,
    subject: `Reminder: ${payment.name} due on ${payment.next_payment_date}`,
    html
  });
}

async function sendSalarySlipEmail(salary, toEmail, pdfPath, settings) {
  const transporter = getTransporter(settings);
  const symbol = settings.currency_symbol || 'Rs.';
  const companyName = settings.company_name || 'GroovyMark';

  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin:0; background:#f4f6f9; }
    .container { max-width:600px; margin:30px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#10b981,#059669); padding:32px; color:#fff; text-align:center; }
    .body { padding:32px; }
    .slip-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:20px; margin:20px 0; }
    .row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; border-bottom:1px solid #d1fae5; }
    .row:last-child { border-bottom:none; font-weight:700; font-size:16px; color:#065f46; }
    .footer { background:#f8f9ff; padding:20px; text-align:center; font-size:12px; color:#888; }
  </style></head>
  <body>
  <div class="container">
    <div class="header">
      <h1>💼 Salary Slip</h1>
      <p>${companyName} &bull; ${salary.payment_month}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${salary.employee_name}</strong>,</p>
      <p>Please find attached your salary slip for <strong>${salary.payment_month}</strong>.</p>
      <div class="slip-box">
        <div class="row"><span>Employee</span><span>${salary.employee_name}</span></div>
        <div class="row"><span>Position</span><span>${salary.position || '-'}</span></div>
        <div class="row"><span>Department</span><span>${salary.department || '-'}</span></div>
        <div class="row"><span>Basic Salary</span><span>${formatCurrency(salary.base_salary, symbol)}</span></div>
        <div class="row"><span>Bonuses</span><span>+ ${formatCurrency(salary.bonuses, symbol)}</span></div>
        <div class="row"><span>Deductions</span><span>- ${formatCurrency(salary.deductions, symbol)}</span></div>
        <div class="row"><span>Net Salary</span><span>${formatCurrency(salary.net_salary, symbol)}</span></div>
      </div>
      <p>Payment Method: ${salary.payment_method || 'Bank Transfer'}</p>
    </div>
    <div class="footer"><p>${companyName} &bull; ${settings.company_email}</p></div>
  </div>
  </body></html>
  `;

  await transporter.sendMail({
    from: `"${companyName} HR" <${settings.smtp_user}>`,
    to: toEmail,
    subject: `Salary Slip - ${salary.payment_month} | ${companyName}`,
    html,
    attachments: pdfPath ? [{ filename: `SalarySlip-${salary.employee_name}-${salary.payment_month}.pdf`, path: pdfPath }] : []
  });
}

async function sendTestEmail(settings) {
  const transporter = getTransporter(settings);
  await transporter.sendMail({
    from: `"${settings.company_name}" <${settings.smtp_user}>`,
    to: settings.smtp_user,
    subject: '✅ Email Test - GroovyMark Financial System',
    text: 'Your email configuration is working correctly!'
  });
}

async function sendLeaveRequestEmail(employee, leaveRequest, settings) {
  const transporter = getTransporter(settings);
  const companyName = settings.company_name || 'GroovyMark';
  const adminEmail = settings.company_email || settings.smtp_user;

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
    .container{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;color:#fff}
    .header h1{margin:0;font-size:20px}
    .header p{margin:4px 0 0;opacity:.85;font-size:13px}
    .body{padding:28px 32px}
    .info-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
    .row:last-child{border:none;font-weight:700}
    .footer{background:#f1f5f9;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head>
  <body><div class="container">
    <div class="header">
      <h1>📋 Leave Request</h1>
      <p>${companyName} HR System</p>
    </div>
    <div class="body">
      <p>A new leave request has been submitted and requires your review.</p>
      <div class="info-box">
        <div class="row"><span>Employee</span><span>${employee.employeeName}</span></div>
        <div class="row"><span>Position</span><span>${employee.employeePosition || '-'}</span></div>
        <div class="row"><span>Leave Type</span><span>${leaveRequest.leave_type}</span></div>
        <div class="row"><span>From</span><span>${leaveRequest.start_date}</span></div>
        <div class="row"><span>To</span><span>${leaveRequest.end_date}</span></div>
        <div class="row"><span>Days Requested</span><span>${leaveRequest.days_count} day(s)</span></div>
        ${leaveRequest.reason ? `<div class="row"><span>Reason</span><span>${leaveRequest.reason}</span></div>` : ''}
      </div>
      <p style="font-size:13px;color:#64748b">Please log into the GroovyMark Financial System to approve or reject this request.</p>
    </div>
    <div class="footer"><p>${companyName} &bull; ${adminEmail}</p></div>
  </div></body></html>`;

  await transporter.sendMail({
    from: `"${companyName} HR" <${settings.smtp_user}>`,
    to: adminEmail,
    subject: `Leave Request: ${employee.employeeName} — ${leaveRequest.days_count} day(s) ${leaveRequest.leave_type} Leave`,
    html
  });
}

async function sendLeaveApprovalEmail(leaveRequest, leaveBalance, settings) {
  const transporter = getTransporter(settings);
  const companyName = settings.company_name || 'GroovyMark';
  if (!leaveRequest.employee_email) return;

  const lt = leaveRequest.leave_type.toLowerCase();
  const col = lt === 'annual' ? 'annual' : lt === 'sick' ? 'sick' : 'casual';
  const remaining = leaveBalance ? (leaveBalance[`${col}_total`] || 0) - (leaveBalance[`${col}_used`] || 0) : '?';

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
    .container{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#10b981,#059669);padding:28px 32px;color:#fff}
    .header h1{margin:0;font-size:20px}
    .header p{margin:4px 0 0;opacity:.85;font-size:13px}
    .body{padding:28px 32px}
    .info-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1fae5;font-size:14px}
    .row:last-child{border:none;font-weight:700}
    .balance-badge{display:inline-block;background:#d1fae5;color:#065f46;padding:8px 16px;border-radius:8px;font-size:18px;font-weight:700;margin:12px 0}
    .footer{background:#f1f5f9;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head>
  <body><div class="container">
    <div class="header">
      <h1>✅ Leave Approved</h1>
      <p>${companyName} HR System</p>
    </div>
    <div class="body">
      <p>Dear <strong>${leaveRequest.employee_name}</strong>,</p>
      <p>Your leave request has been <strong>approved</strong>.</p>
      <div class="info-box">
        <div class="row"><span>Leave Type</span><span>${leaveRequest.leave_type}</span></div>
        <div class="row"><span>From</span><span>${leaveRequest.start_date}</span></div>
        <div class="row"><span>To</span><span>${leaveRequest.end_date}</span></div>
        <div class="row"><span>Days Approved</span><span>${leaveRequest.days_count} day(s)</span></div>
      </div>
      <p style="font-size:14px;color:#64748b;margin-bottom:4px">Remaining ${leaveRequest.leave_type} Leave Balance:</p>
      <div class="balance-badge">${remaining} day(s) remaining</div>
      ${leaveRequest.admin_notes ? `<p style="font-size:13px;color:#64748b;background:#f8fafc;padding:10px;border-radius:6px;border-left:3px solid #10b981"><strong>Note from HR:</strong> ${leaveRequest.admin_notes}</p>` : ''}
    </div>
    <div class="footer"><p>${companyName} &bull; ${settings.company_email || settings.smtp_user}</p></div>
  </div></body></html>`;

  await transporter.sendMail({
    from: `"${companyName} HR" <${settings.smtp_user}>`,
    to: leaveRequest.employee_email,
    subject: `Leave Approved — ${leaveRequest.leave_type} (${leaveRequest.start_date} to ${leaveRequest.end_date})`,
    html
  });
}

async function sendLeaveRejectionEmail(leaveRequest, adminNotes, settings) {
  const transporter = getTransporter(settings);
  const companyName = settings.company_name || 'GroovyMark';
  if (!leaveRequest.employee_email) return;

  const html = `<!DOCTYPE html><html><head><style>
    body{font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:0}
    .container{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;color:#fff}
    .header h1{margin:0;font-size:20px}
    .header p{margin:4px 0 0;opacity:.85;font-size:13px}
    .body{padding:28px 32px}
    .info-box{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #fef3c7;font-size:14px}
    .row:last-child{border:none}
    .footer{background:#f1f5f9;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8}
  </style></head>
  <body><div class="container">
    <div class="header">
      <h1>Leave Request Update</h1>
      <p>${companyName} HR System</p>
    </div>
    <div class="body">
      <p>Dear <strong>${leaveRequest.employee_name}</strong>,</p>
      <p>We regret to inform you that your leave request could not be approved at this time.</p>
      <div class="info-box">
        <div class="row"><span>Leave Type</span><span>${leaveRequest.leave_type}</span></div>
        <div class="row"><span>From</span><span>${leaveRequest.start_date}</span></div>
        <div class="row"><span>To</span><span>${leaveRequest.end_date}</span></div>
        <div class="row"><span>Days Requested</span><span>${leaveRequest.days_count} day(s)</span></div>
      </div>
      ${adminNotes ? `<p style="font-size:13px;color:#64748b;background:#f8fafc;padding:10px;border-radius:6px;border-left:3px solid #f59e0b"><strong>Note from HR:</strong> ${adminNotes}</p>` : ''}
      <p style="font-size:13px;color:#64748b">If you have any questions, please contact HR directly.</p>
    </div>
    <div class="footer"><p>${companyName} &bull; ${settings.company_email || settings.smtp_user}</p></div>
  </div></body></html>`;

  await transporter.sendMail({
    from: `"${companyName} HR" <${settings.smtp_user}>`,
    to: leaveRequest.employee_email,
    subject: `Leave Request — ${leaveRequest.leave_type} (${leaveRequest.start_date} to ${leaveRequest.end_date})`,
    html
  });
}

module.exports = { sendInvoiceEmail, sendPaymentReminderEmail, sendRecurringReminderEmail, sendSalarySlipEmail, sendTestEmail, sendLeaveRequestEmail, sendLeaveApprovalEmail, sendLeaveRejectionEmail };
