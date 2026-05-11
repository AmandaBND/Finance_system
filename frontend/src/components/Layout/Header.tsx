import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, RefreshCw } from 'lucide-react'
import { notificationApi } from '../../services/api'
import { format } from 'date-fns'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/revenue': 'Revenue',
  '/invoices': 'Invoices',
  '/expenses': 'Expenses',
  '/salaries': 'Payroll',
  '/recurring': 'Recurring Payments',
  '/clients': 'Clients',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export default function Header() {
  const { pathname } = useLocation()
  const [notifCount, setNotifCount] = useState(0)
  const [notifs, setNotifs] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    loadNotifs()
    const t = setInterval(loadNotifs, 60000)
    return () => clearInterval(t)
  }, [])

  async function loadNotifs() {
    try {
      const [countRes, listRes] = await Promise.all([notificationApi.unreadCount(), notificationApi.list()])
      setNotifCount(countRes.data.count)
      setNotifs(listRes.data)
    } catch {}
  }

  async function markAllRead() {
    await notificationApi.markAllRead()
    setNotifCount(0)
    setNotifs(notifs.map(n => ({ ...n, is_read: 1 })))
  }

  const typeColors: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    critical: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
  }

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{pageTitles[pathname] || 'GroovyMark'}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-500">System Status</p>
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-medium text-emerald-600">Live & Automated</span>
          </div>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="relative w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <Bell size={16} className="text-slate-600" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="font-semibold text-sm text-slate-700">Notifications</span>
                <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <RefreshCw size={11} /> Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-8">No notifications</p>
                ) : notifs.slice(0, 15).map(n => (
                  <div key={n.id} className={`px-4 py-3 border-b border-slate-50 ${n.is_read ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-2">
                      <span className={`badge mt-0.5 ${typeColors[n.type] || 'bg-slate-100 text-slate-600'}`}>
                        {n.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{n.created_at?.slice(0, 16)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
