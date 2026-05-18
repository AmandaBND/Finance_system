/** Mirrors backend RBAC for UI hiding */
const PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: ['*'],
  accountant: ['invoices', 'expenses', 'revenue', 'reports', 'clients', 'recurring', 'dashboard', 'settings', 'notifications', 'currency', 'projects', 'tasks', 'portal_admin'],
  viewer: ['dashboard', 'reports', 'clients', 'notifications'],
}

function match(granted: string, needed: string) {
  if (granted === '*') return true
  if (granted === needed) return true
  const [a, b] = granted.split('.')
  const [x, y] = needed.split('.')
  return a === x && (b === '*' || y === '*')
}

export function canAccessRole(role: string | undefined, section: string) {
  const r = (role || 'admin').toLowerCase()
  const list = PERMISSIONS[r]
  if (!list) return false
  for (const g of list) {
    if (match(g, section) || match(g, `${section}.*`)) return true
  }
  return false
}

export const NAV_SECTION_KEYS: Record<string, string> = {
  '/app/dashboard': 'dashboard',
  '/app/revenue': 'revenue',
  '/app/invoices': 'invoices',
  '/app/expenses': 'expenses',
  '/app/salaries': 'salaries',
  '/app/recurring': 'recurring',
  '/app/clients': 'clients',
  '/app/projects': 'projects',
  '/app/tasks': 'tasks',
  '/app/reports': 'reports',
  '/app/settings': 'settings',
}
