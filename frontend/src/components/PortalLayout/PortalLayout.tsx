import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, CreditCard, History, LogOut, Menu, X, ChevronRight } from 'lucide-react'

const NAV = [
  { to: '/portal/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/portal/invoices', icon: FileText, label: 'Invoices' },
  { to: '/portal/history', icon: History, label: 'Payment History' },
]

export default function PortalLayout() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const clientRaw = localStorage.getItem('portal_client')
  const client = clientRaw ? JSON.parse(clientRaw) : {}

  function logout() {
    localStorage.removeItem('portal_token')
    localStorage.removeItem('portal_client')
    navigate('/portal/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">G</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">GroovyMark</p>
            <p className="text-indigo-400 text-xs">Client Portal</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-slate-400 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Client info */}
        <div className="px-4 py-3 mx-3 mt-4 bg-white/5 rounded-xl">
          <p className="text-white font-semibold text-sm truncate">{client.clientName || 'Client'}</p>
          {client.clientCompany && <p className="text-slate-400 text-xs truncate">{client.clientCompany}</p>}
          <p className="text-slate-500 text-xs truncate mt-0.5">{client.clientEmail || ''}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 text-slate-500 hover:text-slate-700 rounded-lg">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span>GroovyMark</span>
            <ChevronRight size={14} />
            <span className="text-slate-700 font-medium">Client Portal</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <span className="text-indigo-600 text-xs font-bold">{(client.clientName || 'C')[0].toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">{client.clientName}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
