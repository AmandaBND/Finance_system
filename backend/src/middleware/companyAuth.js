const jwt = require('jsonwebtoken');
const { SEED_COMPANY_ID } = require('../saasPhase1Migrate');

const SECRET = process.env.JWT_SECRET || 'groovymark-portal-jwt-2026-secure';

function parseBearer(req) {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}

/**
 * Requires admin / company app JWT. Sets req.companyId, req.userRole, req.appUserId (nullable for legacy).
 */
function requireCompanyAuth(req, res, next) {
  const token = parseBearer(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, SECRET);
    req.authPayload = payload;
    if (payload.type === 'saas') {
      req.companyId = payload.companyId;
      req.userRole = payload.role || 'owner';
      req.appUserId = payload.sub || null;
      req.authType = 'saas';
      return next();
    }
    if (payload.type === 'legacy_admin' || (payload.username && payload.role === 'admin')) {
      req.companyId = process.env.SEED_COMPANY_ID || SEED_COMPANY_ID;
      req.userRole = 'admin';
      req.appUserId = null;
      req.authType = 'legacy_admin';
      return next();
    }
    return res.status(401).json({ error: 'Invalid token' });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireCompanyAuth, parseBearer, SECRET };
