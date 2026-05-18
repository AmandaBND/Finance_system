const jwt = require('jsonwebtoken');
const { SEED_COMPANY_ID } = require('../saasPhase1Migrate');
const SECRET = process.env.JWT_SECRET || 'groovymark-portal-jwt-2026-secure';

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, SECRET);
    if (!payload.companyId) payload.companyId = process.env.SEED_COMPANY_ID || SEED_COMPANY_ID;
    req.employee = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
