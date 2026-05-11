const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../database');

const PDF_DIR = path.join(__dirname, '../../uploads/pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

function formatCurrency(amount, symbol = 'Rs.') {
  return `${symbol} ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;
}

function drawHLine(doc, y, x1, x2, color = '#e2e8f0') {
  doc.moveTo(x1, y).lineTo(x2, y).strokeColor(color).lineWidth(0.5).stroke();
}

async function generateInvoicePDF(invoice, settings) {
  return new Promise((resolve, reject) => {
    try {
      const symbol = settings?.currency_symbol || 'Rs.';
      const companyName = settings?.company_name || 'GroovyMark';
      const logoPath = settings?.logo_path ? path.join(__dirname, '../../', settings.logo_path) : null;

      const filename = `Invoice-${invoice.invoice_number}-${Date.now()}.pdf`;
      const filepath = path.join(PDF_DIR, filename);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      const W = 595, M = 50, CW = W - M * 2;

      // Header background
      doc.rect(0, 0, W, 160).fill('#0f172a');

      // Logo or company name
      let logoLoaded = false;
      if (logoPath && fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, M, 30, { height: 60, fit: [120, 60] });
          logoLoaded = true;
        } catch (e) {}
      }
      if (!logoLoaded) {
        doc.fontSize(24).fillColor('#ffffff').font('Helvetica-Bold').text(companyName, M, 45);
      }

      doc.fontSize(11).fillColor('#94a3b8').font('Helvetica').text(settings?.company_address || '', M, logoLoaded ? 100 : 80, { width: 200 });

      // INVOICE title (right side)
      doc.fontSize(32).fillColor('#6366f1').font('Helvetica-Bold').text('INVOICE', W - M - 180, 45, { width: 180, align: 'right' });
      doc.fontSize(12).fillColor('#94a3b8').font('Helvetica').text(`#${invoice.invoice_number}`, W - M - 180, 85, { width: 180, align: 'right' });

      // Status badge
      const statusColors = { Draft: '#64748b', Sent: '#3b82f6', Paid: '#10b981', Overdue: '#ef4444' };
      const statusColor = statusColors[invoice.status] || '#64748b';
      doc.roundedRect(W - M - 80, 110, 80, 24, 5).fill(statusColor);
      doc.fontSize(10).fillColor('#ffffff').font('Helvetica-Bold').text(invoice.status, W - M - 80, 117, { width: 80, align: 'center' });

      // Bill To section
      let y = 180;
      doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('BILL TO', M, y);
      y += 16;
      doc.fontSize(13).fillColor('#1e293b').font('Helvetica-Bold').text(invoice.client_name, M, y);
      y += 18;
      if (invoice.client_company) { doc.fontSize(10).fillColor('#475569').font('Helvetica').text(invoice.client_company, M, y); y += 15; }
      if (invoice.client_email) { doc.fontSize(10).fillColor('#475569').text(invoice.client_email, M, y); y += 15; }
      if (invoice.client_address) { doc.fontSize(10).fillColor('#475569').text(invoice.client_address, M, y, { width: 220 }); }

      // Dates (right side)
      const dateX = W - M - 180;
      doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('INVOICE DATE', dateX, 180, { width: 180, align: 'right' });
      doc.fontSize(11).fillColor('#1e293b').font('Helvetica').text(invoice.issue_date, dateX, 196, { width: 180, align: 'right' });
      doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('DUE DATE', dateX, 222, { width: 180, align: 'right' });
      doc.fontSize(11).fillColor('#1e293b').font('Helvetica').text(invoice.due_date, dateX, 238, { width: 180, align: 'right' });

      // Items table
      y = 290;
      drawHLine(doc, y - 5, M, W - M, '#e2e8f0');
      doc.rect(M, y - 5, CW, 28).fill('#f8fafc');
      doc.fontSize(9).fillColor('#475569').font('Helvetica-Bold');
      doc.text('DESCRIPTION', M + 8, y + 2);
      doc.text('QTY', M + CW * 0.55, y + 2, { width: 60, align: 'center' });
      doc.text('UNIT PRICE', M + CW * 0.68, y + 2, { width: 80, align: 'right' });
      doc.text('AMOUNT', M + CW * 0.83, y + 2, { width: CW * 0.17, align: 'right' });
      y += 30;

      const items = invoice.items || [];
      items.forEach((item, i) => {
        if (i % 2 === 1) doc.rect(M, y - 2, CW, 24).fill('#fafafa');
        doc.fontSize(10).fillColor('#1e293b').font('Helvetica').text(item.description, M + 8, y + 2, { width: CW * 0.52 });
        doc.text(String(item.quantity || 1), M + CW * 0.55, y + 2, { width: 60, align: 'center' });
        doc.text(formatCurrency(item.unit_price, symbol), M + CW * 0.68, y + 2, { width: 80, align: 'right' });
        doc.text(formatCurrency(item.amount || (item.quantity * item.unit_price), symbol), M + CW * 0.83, y + 2, { width: CW * 0.17, align: 'right' });
        drawHLine(doc, y + 22, M, W - M);
        y += 26;
      });

      // Totals
      y += 10;
      const totalsX = W - M - 200;
      doc.fontSize(10).fillColor('#475569').font('Helvetica');
      doc.text('Subtotal:', totalsX, y, { width: 100, align: 'right' });
      doc.text(formatCurrency(invoice.subtotal, symbol), totalsX + 105, y, { width: 95, align: 'right' });
      y += 18;
      if (invoice.tax_rate > 0) {
        doc.text(`Tax (${invoice.tax_rate}%):`, totalsX, y, { width: 100, align: 'right' });
        doc.text(formatCurrency(invoice.tax_amount, symbol), totalsX + 105, y, { width: 95, align: 'right' });
        y += 18;
      }
      if (invoice.discount > 0) {
        doc.fillColor('#ef4444').text('Discount:', totalsX, y, { width: 100, align: 'right' });
        doc.text(`- ${formatCurrency(invoice.discount, symbol)}`, totalsX + 105, y, { width: 95, align: 'right' });
        y += 18;
      }
      drawHLine(doc, y + 2, totalsX, W - M, '#6366f1');
      y += 10;
      doc.fontSize(14).fillColor('#0f172a').font('Helvetica-Bold');
      doc.text('TOTAL:', totalsX, y, { width: 100, align: 'right' });
      doc.fillColor('#6366f1').text(formatCurrency(invoice.total, symbol), totalsX + 105, y, { width: 95, align: 'right' });

      // Notes & Terms
      if (invoice.notes || invoice.terms) {
        y += 50;
        drawHLine(doc, y, M, W - M);
        y += 12;
        if (invoice.notes) {
          doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('NOTES', M, y);
          y += 14;
          doc.fontSize(9).fillColor('#475569').font('Helvetica').text(invoice.notes, M, y, { width: CW });
          y += 24;
        }
        if (invoice.terms) {
          doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('TERMS & CONDITIONS', M, y);
          y += 14;
          doc.fontSize(9).fillColor('#475569').font('Helvetica').text(invoice.terms, M, y, { width: CW });
        }
      }

      // Footer
      const footerY = 750;
      doc.rect(0, footerY, W, 92).fill('#0f172a');
      doc.fontSize(10).fillColor('#94a3b8').font('Helvetica').text(`Thank you for your business!`, M, footerY + 20, { width: CW, align: 'center' });
      doc.fontSize(9).fillColor('#64748b').text(`${settings?.company_email || ''} | ${settings?.company_phone || ''} | ${settings?.company_website || ''}`, M, footerY + 42, { width: CW, align: 'center' });

      doc.end();
      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
}

async function generateSalarySlipPDF(salary, settings) {
  return new Promise((resolve, reject) => {
    try {
      const symbol = settings?.currency_symbol || 'Rs.';
      const companyName = settings?.company_name || 'GroovyMark';
      const logoPath = settings?.logo_path ? path.join(__dirname, '../../', settings.logo_path) : null;

      const filename = `SalarySlip-${salary.employee_name}-${salary.payment_month}-${Date.now()}.pdf`;
      const filepath = path.join(PDF_DIR, filename);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      const W = 595, M = 50, CW = W - M * 2;

      // Header
      doc.rect(0, 0, W, 140).fill('#0f172a');
      let logoLoaded = false;
      if (logoPath && fs.existsSync(logoPath)) {
        try { doc.image(logoPath, M, 25, { height: 55, fit: [110, 55] }); logoLoaded = true; } catch (e) {}
      }
      if (!logoLoaded) {
        doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text(companyName, M, 40);
      }
      doc.fontSize(20).fillColor('#10b981').font('Helvetica-Bold').text('SALARY SLIP', W - M - 180, 40, { width: 180, align: 'right' });
      doc.fontSize(11).fillColor('#94a3b8').font('Helvetica').text(salary.payment_month, W - M - 180, 68, { width: 180, align: 'right' });
      doc.fontSize(9).fillColor('#64748b').text(settings?.company_address || '', M, logoLoaded ? 88 : 72, { width: 200 });

      // Employee Info
      let y = 160;
      doc.rect(M, y, CW, 80).fill('#f0fdf4').stroke('#d1fae5');
      y += 12;
      doc.fontSize(9).fillColor('#065f46').font('Helvetica-Bold').text('EMPLOYEE DETAILS', M + 16, y);
      y += 16;
      doc.fontSize(13).fillColor('#1e293b').font('Helvetica-Bold').text(salary.employee_name, M + 16, y);
      doc.fontSize(11).fillColor('#059669').font('Helvetica').text(salary.position || '', M + 16, y + 18);
      doc.fontSize(10).fillColor('#475569').text(`Department: ${salary.department || '-'}`, M + 16, y + 34);
      doc.fontSize(10).fillColor('#475569').text(`Pay Period: ${salary.payment_month}`, W - M - 200, y + 2, { width: 184, align: 'right' });
      doc.text(`Payment Date: ${salary.payment_date || '-'}`, W - M - 200, y + 18, { width: 184, align: 'right' });
      doc.text(`Method: ${salary.payment_method || 'Bank Transfer'}`, W - M - 200, y + 34, { width: 184, align: 'right' });

      // Earnings & Deductions
      y = 268;
      doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('EARNINGS', M, y);
      doc.text('DEDUCTIONS', W / 2 + 10, y);
      y += 14;

      // Left column - Earnings
      const col1 = M, col2 = W / 2 + 10;
      const rowH = 26;
      const earnings = [['Basic Salary', salary.base_salary], ['Bonuses', salary.bonuses]];
      const deductions = [['Deductions', salary.deductions]];

      earnings.forEach(([label, val], i) => {
        if (i % 2 === 0) doc.rect(col1, y - 2, CW / 2 - 10, rowH).fill('#f8fafc');
        doc.fontSize(10).fillColor('#1e293b').font('Helvetica').text(label, col1 + 8, y + 4);
        doc.text(formatCurrency(val || 0, symbol), col1, y + 4, { width: CW / 2 - 18, align: 'right' });
        y += rowH;
      });

      y = 282;
      deductions.forEach(([label, val], i) => {
        doc.rect(col2, y - 2, CW / 2 - 5, rowH).fill(i % 2 === 0 ? '#fef2f2' : '#f8fafc');
        doc.fontSize(10).fillColor('#1e293b').font('Helvetica').text(label, col2 + 8, y + 4);
        doc.fillColor('#ef4444').text(formatCurrency(val || 0, symbol), col2, y + 4, { width: CW / 2 - 13, align: 'right' });
        y += rowH;
      });

      // Net Salary
      y = 360;
      doc.rect(M, y, CW, 60).fill('#0f172a');
      doc.fontSize(14).fillColor('#94a3b8').font('Helvetica-Bold').text('NET SALARY', M + 20, y + 18);
      doc.fontSize(22).fillColor('#10b981').font('Helvetica-Bold').text(formatCurrency(salary.net_salary, symbol), M, y + 14, { width: CW - 20, align: 'right' });

      // Notes
      if (salary.notes) {
        y += 80;
        doc.fontSize(9).fillColor('#64748b').font('Helvetica-Bold').text('NOTES', M, y);
        doc.fontSize(9).fillColor('#475569').font('Helvetica').text(salary.notes, M, y + 14, { width: CW });
      }

      // Footer
      doc.rect(0, 750, W, 92).fill('#0f172a');
      doc.fontSize(9).fillColor('#94a3b8').font('Helvetica').text('This is a computer-generated salary slip and does not require a signature.', M, 770, { width: CW, align: 'center' });
      doc.fontSize(8).fillColor('#64748b').text(`${companyName} | ${settings?.company_email || ''} | ${settings?.company_phone || ''}`, M, 792, { width: CW, align: 'center' });

      doc.end();
      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
}

module.exports = { generateInvoicePDF, generateSalarySlipPDF };
