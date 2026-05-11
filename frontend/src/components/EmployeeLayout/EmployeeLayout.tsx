import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Wallet, CalendarDays, BarChart3, Menu, X, LogOut, Briefcase, ChevronRight, CheckSquare } from 'lucide-react'

const NAV = [
  { to: '/employee/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/employee/salaries', icon: Wallet, label: 'My Salaries' },
  { to: '/employee/leaves', icon: CalendarDays, label: 'Leave' },
  { to: '/employee/kpi', icon: BarChart3, label: 'My KPI' },
  { to: '/employee/tasks', icon: CheckSquare, label: 'My Tasks' },
]

export default function EmployeeLayout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const info = (() => {
    try { return JSON.parse(localStorage.getItem('employee_info') || '{}') } catch { return {} }
  })()

  function logout() {
    localStorage.removeItem('employee_token')
    localStorage.removeItem('employee_info')
    navigate('/employee/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 flex flex-col z-30 transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Briefcase size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">GroovyMark</p>
              <p className="text-emerald-400 text-[10px]">Employee Portal</p>
            </div>
          </div>
        </div>

        {/* Employee info */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="bg-white/5 rounded-xl p-3">
            <p className="text-white font-semibold text-sm truncate">{info.employeeName || 'Employee'}</p>
            {info.employeePosition && <p className="text-emerald-400 text-xs mt-0.5 truncate">{info.employeePosition}</p>}
            {info.department && <p className="text-slate-500 text-xs truncate">{info.department}</p>}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-white/5 text-sm font-medium transition-colors">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 h-14 flex items-center px-4 gap-3 sticky top-0 z-10">
          <button onClick={() => setOpen(!open)} className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Employee Portal</span>
            <ChevronRight size={12} />
            <span className="text-slate-700 font-medium">{info.employeeName || 'Dashboard'}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
              {(info.employeeName || 'E')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
