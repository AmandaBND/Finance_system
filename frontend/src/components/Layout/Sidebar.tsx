import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, FileText, Receipt, Users2,
  RefreshCw, BarChart3, Settings, Users, Wallet, LogOut,
  FolderKanban, CheckSquare
} from 'lucide-react'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/revenue', icon: TrendingUp, label: 'Revenue' },
  { to: '/invoices', icon: FileText, label: 'Invoices' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/salaries', icon: Wallet, label: 'Payroll' },
  { to: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const adminUser = localStorage.getItem('admin_user') || 'Admin'

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    navigate('/login', { replace: true })
  }

  return (
    <div className="w-60 bg-sidebar flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">GroovyMark</p>
            <p className="text-slate-400 text-xs">Financial System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-3 py-2 mb-1">Main Menu</p>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={17} />
          <span>Settings</span>
        </NavLink>
        <div className="mt-3 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center">
              <span className="text-primary-light text-xs font-bold uppercase">{adminUser.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{adminUser}</p>
              <p className="text-slate-500 text-xs">Super Admin</p>
            </div>
            <button onClick={logout} title="Logout" className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
