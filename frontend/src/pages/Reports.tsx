import { useState, useEffect } from 'react'
import { reportApi, formatCurrency } from '../services/api'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { format } from 'date-fns'

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#0ea5e9','#8b5cf6','#ec4899','#14b8a6']

export default function Reports() {
  const [tab, setTab] = useState<'pl'|'revenue'|'expenses'|'cashflow'|'payroll'>('pl')
  const [plData, setPlData] = useState<any>(null)
  const [revData, setRevData] = useState<any>(null)
  const [expData, setExpData] = useState<any>(null)
  const [cfData, setCfData] = useState<any>(null)
  const [payrollData, setPayrollData] = useState<any>(null)
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [year, setYear] = useState(format(new Date(), 'yyyy'))

  useEffect(() => { loadAll() }, [month, year])

  async function loadAll() {
    try {
      const [pl, rev, exp, cf, pr] = await Promise.all([
        reportApi.pl({ month }),
        reportApi.revenue({ from: `${year}-01-01`, to: `${year}-12-31` }),
        reportApi.expenses({ from: `${year}-01-01`, to: `${year}-12-31` }),
        reportApi.cashflow({ year }),
        reportApi.payroll({ month })
      ])
      setPlData(pl.data)
      setRevData(rev.data)
      setExpData(exp.data)
      setCfData(cf.data)
      setPayrollData(pr.data)
    } catch {}
  }

  const tabs = [
    { id: 'pl', label: 'P&L Report' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'cashflow', label: 'Cash Flow' },
    { id: 'payroll', label: 'Payroll' },
  ]

  return (
    <div className="space-y-5 fade-in">
      {/* Tab navigation */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t.label}</button>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2"><label className="text-sm text-slate-500 font-medium">Month:</label><input type="month" className="input w-36" value={month} onChange={e => setMonth(e.target.value)} /></div>
        <div className="flex items-center gap-2"><label className="text-sm text-slate-500 font-medium">Year:</label><input type="number" className="input w-24" value={year} onChange={e => setYear(e.target.value)} min="2020" max="2030" /></div>
      </div>

      {/* P&L Tab */}
      {tab === 'pl' && plData && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 border-l-4 border-emerald-400"><p className="text-xs text-slate-500">Total Revenue</p><p className="text-xl font-bold text-emerald-600">{formatCurrency(plData.revenue)}</p></div>
            <div className="card p-4 border-l-4 border-red-400"><p className="text-xs text-slate-500">Total Expenses</p><p className="text-xl font-bold text-red-500">{formatCurrency(plData.totalExpenses + plData.salaries)}</p></div>
            <div className="card p-4 border-l-4 border-blue-400"><p className="text-xs text-slate-500">Net Profit</p><p className={`text-xl font-bold ${plData.netProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{formatCurrency(plData.netProfit)}</p></div>
            <div className="card p-4 border-l-4 border-purple-400"><p className="text-xs text-slate-500">Profit Margin</p><p className="text-xl font-bold text-purple-600">{plData.profitMargin}%</p></div>
          </div>
          <div className="card p-5">
            <h3 className="section-title mb-4">P&L Statement — {plData.period}</h3>
            <table className="w-full">
              <tbody className="text-sm">
                <tr className="border-b border-slate-100"><td className="py-3 font-semibold text-slate-700">REVENUE</td><td className="py-3 text-right font-bold text-emerald-600">{formatCurrency(plData.revenue)}</td></tr>
                <tr className="border-b border-slate-100 bg-slate-50"><td className="py-2 pl-4 text-slate-500">Gross Revenue</td><td className="py-2 text-right text-slate-600">{formatCurrency(plData.revenue)}</td></tr>
                <tr className="border-b border-slate-100 mt-2"><td className="py-3 font-semibold text-slate-700">EXPENSES</td><td className="py-3 text-right font-bold text-red-500">{formatCurrency(plData.totalExpenses)}</td></tr>
                {plData.expenses.map((e: any) => <tr key={e.category} className="border-b border-slate-50 bg-slate-50"><td className="py-2 pl-4 text-slate-500">{e.category}</td><td className="py-2 text-right text-slate-600">{formatCurrency(e.total)}</td></tr>)}
                <tr className="border-b border-slate-100"><td className="py-3 pl-4 text-slate-600 font-medium">Salaries & Payroll</td><td className="py-3 text-right text-slate-600">{formatCurrency(plData.salaries)}</td></tr>
                <tr className="bg-slate-50 border-t-2 border-slate-200"><td className="py-4 font-bold text-lg text-slate-800">NET PROFIT</td><td className={`py-4 text-right font-bold text-xl ${plData.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(plData.netProfit)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {tab === 'revenue' && revData && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 col-span-3 lg:col-span-1"><p className="text-xs text-slate-500">Total Revenue {year}</p><p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(revData.total)}</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="section-title mb-4">Revenue by Month</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revData.byMonth.map((m: any) => ({ ...m, label: m.month.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', fontSize: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="total" fill="#6366f1" radius={[4,4,0,0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="section-title mb-4">Revenue by Service</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={revData.byService} dataKey="total" nameKey="service_type" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ service_type, percent }) => `${service_type} ${(percent*100).toFixed(0)}%`}>
                    {revData.byService.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="section-title mb-4">Top Clients by Revenue</h3>
            <table className="w-full">
              <thead><tr className="border-b border-slate-100"><th className="table-header text-left">Client</th><th className="table-header text-center">Invoices</th><th className="table-header text-right">Total Revenue</th></tr></thead>
              <tbody>
                {revData.byClient.map((c: any) => <tr key={c.client_name} className="table-row"><td className="table-cell font-medium">{c.client_name}</td><td className="table-cell text-center text-slate-500">{c.count}</td><td className="table-cell text-right font-semibold text-emerald-600">{formatCurrency(c.total)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {tab === 'expenses' && expData && (
        <div className="space-y-5">
          <div className="card p-4 inline-block"><p className="text-xs text-slate-500">Total Expenses {year}</p><p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(expData.total)}</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="section-title mb-4">Expenses by Month</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={expData.byMonth.map((m: any) => ({ ...m, label: m.month.slice(5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', fontSize: 12, border: 'none' }} />
                  <Bar dataKey="total" fill="#f59e0b" radius={[4,4,0,0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="section-title mb-4">By Category</h3>
              <div className="space-y-2">
                {expData.byCategory.map((c: any, i: number) => (
                  <div key={c.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }}></span>
                      <span className="text-sm text-slate-600">{c.category}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(c.total / expData.total * 100)}%`, background: COLORS[i % COLORS.length] }}></div>
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-28 text-right">{formatCurrency(c.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Tab */}
      {tab === 'cashflow' && cfData && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="section-title mb-4">Cash Flow {year}</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={cfData.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: '10px', fontSize: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inflow" fill="#10b981" radius={[4,4,0,0]} name="Cash In" />
                <Bar dataKey="outflow" fill="#ef4444" radius={[4,4,0,0]} name="Cash Out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="table-header text-left">Month</th><th className="table-header text-right">Cash In</th><th className="table-header text-right">Cash Out</th><th className="table-header text-right">Net Flow</th></tr></thead>
              <tbody>
                {cfData.months.map((m: any) => <tr key={m.month} className="table-row">
                  <td className="table-cell font-medium">{m.label} {year}</td>
                  <td className="table-cell text-right text-emerald-600 font-medium">{formatCurrency(m.inflow)}</td>
                  <td className="table-cell text-right text-red-500 font-medium">{formatCurrency(m.outflow)}</td>
                  <td className={`table-cell text-right font-bold ${m.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(m.net)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll Tab */}
      {tab === 'payroll' && payrollData && (
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-4">
            <div className="card p-4"><p className="text-xs text-slate-500">Total Payroll</p><p className="text-xl font-bold text-slate-700 mt-1">{formatCurrency(payrollData.totals?.total_net || 0)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Base Salaries</p><p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(payrollData.totals?.total_base || 0)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Total Bonuses</p><p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(payrollData.totals?.total_bonuses || 0)}</p></div>
            <div className="card p-4"><p className="text-xs text-slate-500">Employees</p><p className="text-xl font-bold text-slate-700 mt-1">{payrollData.totals?.count || 0}</p></div>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                <th className="table-header text-left">Employee</th>
                <th className="table-header text-left">Position</th>
                <th className="table-header text-right">Basic</th>
                <th className="table-header text-right">Bonuses</th>
                <th className="table-header text-right">Deductions</th>
                <th className="table-header text-right">Net</th>
                <th className="table-header text-center">Status</th>
              </tr></thead>
              <tbody>
                {payrollData.records.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No payroll data for {payrollData.month}</td></tr>
                  : payrollData.records.map((r: any) => <tr key={r.id} className="table-row">
                      <td className="table-cell font-medium">{r.employee_name}</td>
                      <td className="table-cell text-slate-500 text-xs">{r.position || '-'}</td>
                      <td className="table-cell text-right">{formatCurrency(r.base_salary)}</td>
                      <td className="table-cell text-right text-emerald-600">+{formatCurrency(r.bonuses)}</td>
                      <td className="table-cell text-right text-red-500">-{formatCurrency(r.deductions)}</td>
                      <td className="table-cell text-right font-bold">{formatCurrency(r.net_salary)}</td>
                      <td className="table-cell text-center"><span className={`badge ${r.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span></td>
                    </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
