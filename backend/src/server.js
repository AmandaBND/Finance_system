require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://finance.aichat.groovymark.com',
  'http://localhost:3001'
];
app.use(cors({
  origin: (origin, cb) => cb(null, true), // same-origin when Express serves frontend
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Auth
app.use("/api/auth", require("./routes/auth"));

// Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/revenue', require('./routes/revenue'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/salaries', require('./routes/salaries'));
app.use('/api/recurring', require('./routes/recurring'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/currency', require('./routes/currency'));

// Client portal routes
app.use('/api/portal', require('./routes/client-auth'));
app.use('/api/portal', require('./routes/client-portal'));
app.use('/api/portal-admin', require('./routes/portal-admin'));

// Employee portal routes
app.use('/api/employee', require('./routes/employee-auth'));
app.use('/api/employee', require('./routes/employee-portal'));
app.use('/api/employee', require('./routes/employee-tasks'));
app.use('/api/employee-admin', require('./routes/employee-admin'));

// Project & Task management routes
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));

// Serve payment slip uploads
const fs = require('fs');
const slipDir = path.join(__dirname, '../uploads/payment-slips');
if (!fs.existsSync(slipDir)) fs.mkdirSync(slipDir, { recursive: true });

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Fetch live exchange rates on startup
const { refreshRates } = require('./services/currencyService');
refreshRates().catch(() => {});

// Start scheduler
require('./services/schedulerService');

// Serve React frontend build (production)
// This handles the case where Apache reverse-proxies to Express,
// or Express is run directly without a separate static file server.
const frontendBuild = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  // SPA catch-all — must be AFTER all API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
  console.log('📦 Serving React build from frontend/dist');
}

app.listen(PORT, () => {
  console.log(`🚀 GroovyMark Financial System running on port ${PORT}`);
});
