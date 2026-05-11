import { useState, useEffect } from 'react'
import { dashboardApi, aiApi, employeeAdminApi, formatCurrency } from '../services/api'
import { TrendingUp, TrendingDown, DollarSign, CreditCard, AlertCircle, RefreshCw, Brain, FileText, Calendar, Zap, Wallet, Gift, X, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6']

function StatCard({ label, value, sub, icon: Icon, color, trend, trendVal }: any) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
        {trendVal !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${parseFloat(trendVal) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {parseFloat(trendVal) >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(trendVal)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function AIInsightCard({ insight }: any) {
  const colors: any = {
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    critical: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  }
  const c = colors[insight.type] || colors.info
  return (
    <div className={`border rounded-lg p-3 ${c}`}>
      <p className="text-sm font-semibold">{insight.title}</p>
      <p className="text-xs mt-1 opacity-80">{insight.detail}</p>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [ai, setAi] = useState<any>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [loading, setLoading] = useState(true)
  const [birthdays, setBirthdays] = useState<any[]>([])
  const [wishTarget, setWishTarget] = useState<any>(null)
  const [wishMsg, setWishMsg] = useState('')
  const [sendingWish, setSendingWish] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      const [dashRes, bdayRes] = await Promise.all([
        dashboardApi.get(),
        employeeAdminApi.upcomingBirthdays().catch(() => ({ data: [] })),
      ])
      setData(dashRes.data)
      setBirthdays(bdayRes.data || [])
    } catch {} finally { setLoading(false) }
    loadAi()
  }

  function openWish(emp: any) {
    const defaultMsg = `🎂 Wishing you a very Happy Birthday, ${emp.name}! May this special day bring you lots of joy and happiness. The whole team is grateful to have you with us. Here's to another amazing year ahead! 🎉🥳`
    setWishMsg(defaultMsg)
    setWishTarget(emp)
  }

  async function sendWish() {
    if (!wishTarget) return
    setSendingWish(true)
    try {
      await employeeAdminApi.sendBirthdayWish(wishTarget.id, wishMsg)
      toast.success(`Birthday wish sent to ${wishTarget.name}! 🎉`)
      setWishTarget(null)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send wish')
    } finally { setSendingWish(false) }
  }

  async function loadAi() {
    try {
      setLoadingAi(true)
      const res = await aiApi.insights()
      setAi(res.data)
    } catch {} finally { setLoadingAi(false) }
  }

  async function refreshAi() {
    try {
      setLoadingAi(true)
      const res = await aiApi.refresh()
      setAi(res.data)
    } catch {} finally { setLoadingAi(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 text-sm">Loading dashboard...</p>
      </div>
    </div>
  )

  const s = data?.stats || {}
  const chartData = data?.chartData || []
  const expBreak = data?.expenseBreakdown || []
  const recentInvoices = data?.recentInvoices || []
  const upcoming = data?.upcomingPayments || []

  const statusColors: any = { Paid: 'bg-emerald-100 text-emerald-700', Sent: 'bg-blue-100 text-blue-700', Draft: 'bg-slate-100 text-slate-600', Overdue: 'bg-red-100 text-red-700' }

  return (
    <div className="space-y-6 fade-in">


      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Monthly Revenue" value={formatCurrency(s.monthRevenue)} sub={`Year: ${formatCurrency(s.yearRevenue)}`} icon={TrendingUp} color="bg-primary" trendVal={s.revenueGrowth} />
        <StatCard label="Monthly Profit" value={formatCurrency(s.monthProfit)} sub={`Margin: ${s.profitMargin}%`} icon={DollarSign} color="bg-emerald-500" trendVal={s.profitGrowth} />
        <StatCard label="Monthly Expenses" value={formatCurrency(s.monthExpenses)} sub={`Burn Rate: ${formatCurrency(s.burnRate)}/mo`} icon={CreditCard} color="bg-amber-500" />
        <StatCard label="Cash Balance" value={formatCurrency(s.cashBalance)} sub={`MRR: ${formatCurrency(s.mrr)}`} icon={DollarSign} color="bg-blue-500" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center"><AlertCircle size={18} className="text-orange-500" /></div>
          <div><p className="text-lg font-bold text-slate-800">{s.overdueInvoices}</p><p className="text-xs text-slate-500">Overdue Invoices</p><p className="text-xs text-orange-500 font-medium">{formatCurrency(s.overdueAmount)}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center"><FileText size={18} className="text-blue-500" /></div>
          <div><p className="text-lg font-bold text-slate-800">{s.pendingInvoices}</p><p className="text-xs text-slate-500">Pending Invoices</p><p className="text-xs text-blue-500 font-medium">{formatCurrency(s.pendingInvoiceAmount)}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center"><TrendingUp size={18} className="text-purple-500" /></div>
          <div><p className="text-lg font-bold text-slate-800">{formatCurrency(s.accountsReceivable)}</p><p className="text-xs text-slate-500">Accounts Receivable</p></div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center"><Wallet size={18} className="text-violet-600" /></div>
          <div><p className="text-lg font-bold text-slate-800">{formatCurrency(s.monthSalaries || 0)}</p><p className="text-xs text-slate-500">Monthly Payroll</p><p className="text-xs text-red-400 font-medium">{s.pendingSalaries} pending · {formatCurrency(s.pendingSalaryAmount)}</p></div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Profit Chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="section-title mb-4">Revenue vs Expenses (6 Months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `Rs.${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
              <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={2} fill="url(#expGrad)" name="Expenses" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="card p-5">
          <h3 className="section-title mb-4">Expense Breakdown</h3>
          {expBreak.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={expBreak} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {expBreak.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', border: 'none', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {expBreak.slice(0, 4).map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }}></span>
                      <span className="text-slate-600">{e.category}</span>
                    </div>
                    <span className="font-medium text-slate-700">{formatCurrency(e.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-slate-400 text-sm text-center py-8">No expense data this month</p>}
        </div>
      </div>

      {/* AI Insights + Upcoming + Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Insights */}
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center"><Brain size={15} className="text-violet-600" /></div>
              <h3 className="section-title">AI Insights</h3>
            </div>
            <button onClick={refreshAi} disabled={loadingAi} className="text-slate-400 hover:text-primary transition-colors">
              <RefreshCw size={14} className={loadingAi ? 'animate-spin' : ''} />
            </button>
          </div>
          {loadingAi ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse"></div>)}
            </div>
          ) : ai ? (
            <div className="space-y-2">
              {ai.summary && <p className="text-xs text-slate-600 mb-3 leading-relaxed italic border-l-2 border-primary pl-3">{ai.summary}</p>}
              {(ai.insights || []).slice(0, 4).map((ins: any, i: number) => <AIInsightCard key={i} insight={ins} />)}
            </div>
          ) : <p className="text-slate-400 text-sm">Configure AI in settings</p>}
        </div>

        {/* AI Predictions */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center"><Zap size={15} className="text-blue-600" /></div>
            <h3 className="section-title">AI Predictions</h3>
          </div>
          {ai?.predictions?.length ? (
            <div className="space-y-3">
              {ai.predictions.map((p: any, i: number) => (
                <div key={i} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-slate-700">{p.metric}</p>
                    <span className={`badge text-[10px] ${p.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : p.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{p.confidence}</span>
                  </div>
                  <p className="text-xs text-slate-500">{p.prediction}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-lg animate-pulse"></div>)}
            </div>
          )}
        </div>

        {/* Upcoming Payments */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center"><Calendar size={15} className="text-amber-600" /></div>
            <h3 className="section-title">Upcoming (7 Days)</h3>
          </div>
          {upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.next_payment_date} · {p.billing_cycle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(p.amount)}</p>
                    <span className={`badge text-[10px] ${p.type === 'Income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{p.type}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-400 text-sm text-center py-8">No upcoming payments</p>}
        </div>
      </div>

      {/* Upcoming Birthdays */}
      {birthdays.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-pink-100 rounded-lg flex items-center justify-center">
              <Gift size={15} className="text-pink-500" />
            </div>
            <h3 className="section-title">Upcoming Birthdays</h3>
            <span className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-medium">Next 30 days</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {birthdays.map((emp: any) => (
              <div key={emp.id} className={`relative flex items-center gap-3 rounded-xl px-4 py-3 border ${emp.is_today ? 'bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${emp.is_today ? 'bg-pink-200' : 'bg-slate-200'}`}>
                  {emp.is_today ? '🎂' : '🎁'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
                  <p className="text-xs text-slate-500">{emp.birthday_display}</p>
                  <p className={`text-xs font-medium mt-0.5 ${emp.is_today ? 'text-pink-600' : emp.days_until <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {emp.is_today ? '🎉 Today!' : `in ${emp.days_until} day${emp.days_until !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button
                  onClick={() => openWish(emp)}
                  className={`shrink-0 p-1.5 rounded-lg text-xs transition-colors ${emp.is_today ? 'bg-pink-500 text-white hover:bg-pink-600' : 'bg-white text-slate-500 hover:text-pink-500 border border-slate-200'}`}
                  title="Send birthday wish"
                >
                  <Send size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="section-title">Recent Invoices</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-100 bg-slate-50">
              <th className="table-header text-left">Invoice</th>
              <th className="table-header text-left">Client</th>
              <th className="table-header text-left">Due Date</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header text-center">Status</th>
            </tr></thead>
            <tbody>
              {recentInvoices.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8 text-sm">No invoices yet</td></tr>
              ) : recentInvoices.map((inv: any) => (
                <tr key={inv.id} className="table-row">
                  <td className="table-cell font-mono text-xs text-primary">{inv.invoice_number}</td>
                  <td className="table-cell font-medium">{inv.client_name}</td>
                  <td className="table-cell text-slate-400 text-xs">{inv.due_date}</td>
                  <td className="table-cell text-right font-semibold">{formatCurrency(inv.total)}</td>
                  <td className="table-cell text-center"><span className={`badge ${statusColors[inv.status]}`}>{inv.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Birthday Wish Confirm Modal */}
      {wishTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setWishTarget(null)}>
          <div className="modal-content max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Gift size={18} className="text-pink-500" />
                <h2 className="text-lg font-bold">Send Birthday Wish</h2>
              </div>
              <button onClick={() => setWishTarget(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 bg-pink-50 rounded-xl px-4 py-3 border border-pink-100">
                <span className="text-2xl">🎂</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{wishTarget.name}</p>
                  <p className="text-xs text-slate-500">{wishTarget.position}{wishTarget.department ? ` · ${wishTarget.department}` : ''}</p>
                  <p className="text-xs text-pink-600 font-medium">{wishTarget.is_today ? '🎉 Birthday is Today!' : `Birthday in ${wishTarget.days_until} day${wishTarget.days_until !== 1 ? 's' : ''} — ${wishTarget.birthday_display}`}</p>
                </div>
              </div>
              <div>
                <label className="label">Wish Message</label>
                <textarea
                  className="input h-28 resize-none text-sm"
                  value={wishMsg}
                  onChange={e => setWishMsg(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">This message will appear as a popup on the employee's dashboard and a notice will be sent to all employees.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setWishTarget(null)} className="btn-secondary">Cancel</button>
                <button onClick={sendWish} disabled={sendingWish || !wishMsg.trim()} className="btn-primary bg-pink-600 hover:bg-pink-500">
                  <Send size={14} /> {sendingWish ? 'Sending...' : 'Send Wish 🎉'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
