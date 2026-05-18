const jwt = require('jsonwebtoken');

const SUPER_SECRET = process.env.SUPERADMIN_JWT_SECRET || process.env.JWT_SECRET || 'groovymark-portal-jwt-2026-secure';

function signSuperadminToken() {
  return jwt.sign({ type: 'superadmin' }, SUPER_SECRET, { expiresIn: '8h' });
}

function requireSuperadmin(req, res, next) {
  const h = req.headers.authorization;
  const token = h && h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const p = jwt.verify(token, SUPER_SECRET);
    if (p.type !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
    req.superadmin = true;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireSuperadmin, signSuperadminToken, SUPER_SECRET };
