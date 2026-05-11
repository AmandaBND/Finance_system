import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { employeeSelfApi as employeeApi, employeeTaskApi } from '../../services/api'
import { Wallet, CalendarDays, TrendingUp, Download, Bell, CheckCircle, AlertCircle, Clock, Play, Pause, X, CheckSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// Confetti particle colors
const CONFETTI_COLORS = ['#f43f5e','#f59e0b','#10b981','#6366f1','#ec4899','#3b82f6','#a855f7','#06b6d4']

function ConfettiPiece({ style }: { style: React.CSSProperties }) {
  return <div className="absolute w-2.5 h-2.5 rounded-sm opacity-90" style={style} />
}

function BirthdayWishPopup({ wish, onClose }: { wish: any; onClose: () => void }) {
  const pieces = useRef(
    Array.from({ length: 50 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: `${Math.random() * 2}s`,
      duration: `${2.5 + Math.random() * 2}s`,
      size: `${8 + Math.random() * 8}px`,
      rotate: `${Math.random() * 360}deg`,
    }))
  ).current

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {pieces.map((p, i) => (
          <ConfettiPiece key={i} style={{
            left: p.left,
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate})`,
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400 px-8 pt-10 pb-8 text-center">
          <div className="text-6xl mb-3 animate-bounce">🎂</div>
          <h2 className="text-2xl font-extrabold text-white">Happy Birthday!</h2>
          <p className="text-pink-100 text-sm mt-1">A special message for you</p>
        </div>
        {/* Message */}
        <div className="px-8 py-6 text-center">
          <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{wish.message}</p>
          <p className="text-xs text-slate-400 mt-4">— from GroovyMark Team 💖</p>
        </div>
        <div className="px-8 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold text-sm hover:from-pink-600 hover:to-rose-600 transition-all shadow-md"
          >
            Thank you! 🎉
          </button>
        </div>
      </div>
    </div>
  )
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

const LEAVE_STATUS_COLORS: any = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

export default function EmployeeDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<any[]>([])
  const [notices, setNotices] = useState<any[]>([])
  const [todayTasks, setTodayTasks] = useState<any[]>([])
  const [dismissedNotices, setDismissedNotices] = useState<Set<number>>(new Set())
  const [ticks, setTicks] = useState(0)
  const [birthdayWish, setBirthdayWish] = useState<any>(null)

  const info = (() => {
    try { return JSON.parse(localStorage.getItem('employee_info') || '{}') } catch { return {} }
  })()

  useEffect(() => { load() }, [])
  useEffect(() => {
    const id = setInterval(() => setTicks(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [dashRes, kpiRes, noticesRes, tasksRes, wishRes] = await Promise.all([
        employeeApi.dashboard(),
        employeeApi.kpi(),
        employeeTaskApi.notices().catch(() => ({ data: [] })),
        employeeTaskApi.list({ date_from: today, date_to: today }).catch(() => ({ data: [] })),
        employeeApi.birthdayWish().catch(() => ({ data: null })),
      ])
      setData(dashRes.data)
      setNotices(noticesRes.data || [])
      setTodayTasks((tasksRes.data || []).filter((t: any) => !['completed','overdue'].includes(t.status)))
      if (wishRes.data) setBirthdayWish(wishRes.data)
      // Build 6-month chart
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date()
        d.setMonth(d.getMonth() - (5 - i))
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })
      const kpiMap: Record<string, any> = {}
      kpiRes.data.forEach((k: any) => { kpiMap[k.month] = k })
      setKpi(months.map(m => ({
        month: m.slice(5),
        score: kpiMap[m]?.performance_score || 0,
        target: kpiMap[m]?.kpi_target || 80,
      })))
    } catch { toast.error('Failed to load dashboard') }
    finally { setLoading(false) }
  }

  async function closeBirthdayWish() {
    setBirthdayWish(null)
    try { await employeeApi.markWishSeen() } catch {}
  }

  async function timerAction(taskId: number, action: 'start'|'hold'|'resume'|'complete') {
    try {
      const res = action === 'complete'
        ? await employeeTaskApi.complete(taskId)
        : action === 'start' ? await employeeTaskApi.start(taskId)
        : action === 'hold' ? await employeeTaskApi.hold(taskId)
        : await employeeTaskApi.resume(taskId)
      const updated = (res.data.task || res.data) as any
      setTodayTasks(prev => prev.map(t => t.id === updated.id ? updated : t).filter(t => !['completed','overdue'].includes(t.status)))
      if (action === 'complete') toast.success('Task completed! 🎉')
    } catch (e: any) { toast.error(e.response?.data?.error || 'Action failed') }
  }

  async function downloadSlip(id: number, month: string) {
    try {
      const res = await employeeApi.downloadSlip(id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `SalarySlip-${month}.pdf`; a.click()
      toast.success('Downloading...')
    } catch { toast.error('Download failed') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!data) return null

  const { stats, recentSalaries, recentLeaves } = data
  const lb = stats.leaveBalance || {}
  const annualRemaining = Math.max(0, (lb.annual_total || 14) - (lb.annual_used || 0))
  const sickRemaining = Math.max(0, (lb.sick_total || 7) - (lb.sick_used || 0))
  const casualRemaining = Math.max(0, (lb.casual_total || 3) - (lb.casual_used || 0))

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Birthday Wish Popup */}
      {birthdayWish && <BirthdayWishPopup wish={birthdayWish} onClose={closeBirthdayWish} />}

      {/* Active Notices */}
      {notices.filter(n => !dismissedNotices.has(n.id)).map(n => (
        <div key={n.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Bell size={15} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">{n.title}</p>
            <p className="text-xs text-amber-700 mt-0.5">{n.message}</p>
          </div>
          <button onClick={() => setDismissedNotices(prev => new Set([...prev, n.id]))} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <CheckSquare size={15} className="text-emerald-500" />
              <h3 className="text-sm font-semibold text-slate-700">Today's Tasks</h3>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{todayTasks.length}</span>
            </div>
            <Link to="/employee/tasks" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {todayTasks.map((task: any) => {
              const displaySecs = (task.total_seconds || 0) + (task.timer_status === 'running' && task.timer_started_at
                ? Math.max(0, Math.floor((Date.now() - new Date(task.timer_started_at).getTime()) / 1000))
                : 0)
              // ticks used to keep timer live
              void ticks
              return (
                <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{task.title}</p>
                    {task.project_name && <p className="text-xs text-slate-400 mt-0.5">{task.project_name}</p>}
                  </div>
                  <span className={`text-xs font-mono font-bold ${task.timer_status === 'running' ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {formatTime(displaySecs)}
                  </span>
                  <div className="flex items-center gap-1">
                    {task.status === 'pending' && (
                      <button onClick={() => timerAction(task.id, 'start')} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg">
                        <Play size={12} />
                      </button>
                    )}
                    {task.timer_status === 'running' && (
                      <>
                        <button onClick={() => timerAction(task.id, 'hold')} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg">
                          <Pause size={12} />
                        </button>
                        <button onClick={() => timerAction(task.id, 'complete')} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg">
                          <CheckCircle size={12} />
                        </button>
                      </>
                    )}
                    {task.status === 'on_hold' && (
                      <>
                        <button onClick={() => timerAction(task.id, 'resume')} className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg">
                          <Play size={12} />
                        </button>
                        <button onClick={() => timerAction(task.id, 'complete')} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg">
                          <CheckCircle size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Welcome */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-emerald-100 text-sm">Welcome back,</p>
        <h1 className="text-2xl font-bold mt-0.5">{info.employeeName}</h1>
        <p className="text-emerald-200 text-sm mt-0.5">{info.employeePosition}{info.department ? ` · ${info.department}` : ''}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={15} className="text-emerald-500" />
            <p className="text-xs text-slate-500">Total Earned</p>
          </div>
          <p className="text-xl font-bold text-slate-700">Rs. {Number(stats.totalEarned || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-0.5">lifetime</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={15} className="text-indigo-500" />
            <p className="text-xs text-slate-500">Last Salary</p>
          </div>
          <p className="text-xl font-bold text-slate-700">Rs. {Number(stats.lastNetSalary || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-0.5">{stats.lastPaymentMonth || '—'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays size={15} className="text-amber-500" />
            <p className="text-xs text-slate-500">Annual Leave</p>
          </div>
          <p className="text-xl font-bold text-slate-700">{annualRemaining} <span className="text-sm font-normal text-slate-400">/ {lb.annual_total || 14}</span></p>
          <p className="text-xs text-slate-400 mt-0.5">days remaining</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={15} className="text-purple-500" />
            <p className="text-xs text-slate-500">KPI This Month</p>
          </div>
          <p className="text-xl font-bold text-slate-700">
            {stats.kpiThisMonth !== null ? `${stats.kpiThisMonth}%` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">target {stats.kpiTarget}%</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* KPI Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">KPI Performance (Last 6 Months)</h3>
          {kpi.every(k => k.score === 0) ? (
            <div className="flex items-center justify-center h-36 text-slate-300 text-sm">No KPI data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={kpi} barSize={24}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${v}%`, 'Score']} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {kpi.map((k, i) => (
                    <Cell key={i} fill={k.score >= k.target ? '#10b981' : k.score >= 60 ? '#6366f1' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leave Balance */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Leave Balance</h3>
          <div className="space-y-3">
            {[
              { label: 'Annual', used: lb.annual_used || 0, total: lb.annual_total || 14, color: 'bg-emerald-500' },
              { label: 'Sick', used: lb.sick_used || 0, total: lb.sick_total || 7, color: 'bg-blue-500' },
              { label: 'Casual', used: lb.casual_used || 0, total: lb.casual_total || 3, color: 'bg-purple-500' },
            ].map(l => (
              <div key={l.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">{l.label}</span>
                  <span className="text-slate-500">{l.total - l.used} / {l.total} left</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${l.color} rounded-full transition-all`} style={{ width: `${Math.min(100, (l.used / l.total) * 100)}%` }} />
                </div>
              </div>
            ))}
            <Link to="/employee/leaves" className="block text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium pt-1">
              Request Leave →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Recent Salaries */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">Recent Salary Payments</h3>
            <Link to="/employee/salaries" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all</Link>
          </div>
          {recentSalaries.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No salary records yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentSalaries.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{s.payment_month}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-slate-800">Rs. {Number(s.net_salary).toLocaleString()}</p>
                    {s.status === 'Paid' && (
                      <button onClick={() => downloadSlip(s.id, s.payment_month)} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Download size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Leave Requests */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">Leave Requests</h3>
            <Link to="/employee/leaves" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">View all</Link>
          </div>
          {recentLeaves.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">No leave requests yet</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentLeaves.map((lr: any) => (
                <div key={lr.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{lr.leave_type} Leave</p>
                    <p className="text-xs text-slate-400 mt-0.5">{lr.start_date} → {lr.end_date} ({lr.days_count}d)</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${LEAVE_STATUS_COLORS[lr.status]}`}>
                    {lr.status === 'Approved' && <CheckCircle size={10} />}
                    {lr.status === 'Pending' && <Clock size={10} />}
                    {lr.status === 'Rejected' && <AlertCircle size={10} />}
                    {lr.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
