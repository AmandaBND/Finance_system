/**
 * RBAC: role → permission strings (resource.action or wildcard).
 */
const PERMISSIONS = {
  owner: ['*'],
  admin: [
    'invoices.*', 'expenses.*', 'clients.*', 'employees.*', 'salaries.*',
    'reports.*', 'settings.*', 'revenue.*', 'recurring.*', 'dashboard.*',
    'notifications.*', 'ai.*', 'currency.*', 'projects.*', 'tasks.*', 'portal_admin.*', 'employee_admin.*',
  ],
  accountant: [
    'invoices.*', 'expenses.*', 'revenue.*', 'reports.*', 'clients.read',
    'dashboard.read', 'notifications.read', 'currency.*', 'recurring.read', 'recurring.update',
  ],
  viewer: ['dashboard.read', 'reports.read', 'clients.read', 'notifications.read', 'currency.read'],
  employee: [],
  client: [],
};

function matchPattern(granted, needed) {
  if (granted === '*') return true;
  if (granted === needed) return true;
  const [gr, ga] = granted.split('.');
  const [nr, na] = needed.split('.');
  if (gr === nr && (ga === '*' || na === '*')) return true;
  return false;
}

function canAccess(role, resource, action = 'read') {
  const needed = `${resource}.${action}`;
  const list = PERMISSIONS[role];
  if (!list) return false;
  for (const g of list) {
    if (matchPattern(g, needed)) return true;
    if (matchPattern(g, `${resource}.*`)) return true;
  }
  return false;
}

/** Express middleware factory: blocks if role cannot perform action on resource (mutations use 'write'). */
function requirePermission(resource, action = 'read') {
  return (req, res, next) => {
    if (req.userRole === 'owner') return next();
    if (canAccess(req.userRole, resource, action)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

/** Block accountant/viewer from mutating (POST/PUT/DELETE) on sensitive collections */
function requireWritePermission(resource) {
  return (req, res, next) => {
    const m = req.method;
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
    if (req.userRole === 'owner') return next();
    const action = 'write';
    if (canAccess(req.userRole, resource, action) || canAccess(req.userRole, resource, 'create')) return next();
    if (req.userRole === 'admin') return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = { canAccess, requirePermission, requireWritePermission, PERMISSIONS };
