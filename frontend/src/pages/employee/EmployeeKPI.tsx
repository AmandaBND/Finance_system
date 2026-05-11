import { useState, useEffect } from 'react'
import { employeeSelfApi as employeeApi } from '../../services/api'
import { TrendingUp, Award, Target } from 'lucide-react'
import toast from 'react-hot-toast'
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export default function EmployeeKPI() {
  const [kpi, setKpi] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await employeeApi.kpi()
      setKpi(res.data)
    } catch { toast.error('Failed to load KPI data') }
    finally { setLoading(false) }
  }

  const sorted = [...kpi].sort((a, b) => a.month.localeCompare(b.month))

  const avgScore = kpi.length > 0 ? Math.round(kpi.reduce((s, k) => s + k.performance_score, 0) / kpi.length) : 0
  const bestMonth = kpi.length > 0 ? kpi.reduce((best, k) => k.performance_score > best.performance_score ? k : best, kpi[0]) : null
  const avgAttendance = kpi.length > 0 ? Math.round(kpi.reduce((s, k) => s + k.attendance_pct, 0) / kpi.length) : 0
  const latestKpi = kpi.length > 0 ? kpi[0] : null // sorted desc from API

  const scoreColor = (score: number) => score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'
  const scoreBg = (score: number) => score >= 80 ? 'bg-emerald-100' : score >= 60 ? 'bg-amber-100' : 'bg-red-100'

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">My KPI & Performance</h1>
        <p className="text-sm text-slate-500 mt-0.5">Monthly performance analytics and scores</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-emerald-500" />
            <p className="text-xs text-slate-500">Avg Score</p>
          </div>
          <p className={`text-2xl font-bold ${scoreColor(avgScore)}`}>{avgScore}%</p>
          <p className="text-xs text-slate-400 mt-0.5">all time</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Award size={14} className="text-amber-500" />
            <p className="text-xs text-slate-500">Best Month</p>
          </div>
          <p className={`text-2xl font-bold ${bestMonth ? scoreColor(bestMonth.performance_score) : 'text-slate-400'}`}>
            {bestMonth ? `${bestMonth.performance_score}%` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{bestMonth?.month || '—'}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-indigo-500" />
            <p className="text-xs text-slate-500">Current Month</p>
          </div>
          <p className={`text-2xl font-bold ${latestKpi ? scoreColor(latestKpi.performance_score) : 'text-slate-400'}`}>
            {latestKpi ? `${latestKpi.performance_score}%` : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">target {latestKpi?.kpi_target || 80}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-blue-500" />
            <p className="text-xs text-slate-500">Avg Attendance</p>
          </div>
          <p className={`text-2xl font-bold ${scoreColor(avgAttendance)}`}>{avgAttendance}%</p>
          <p className="text-xs text-slate-400 mt-0.5">all time</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Performance vs Target</h3>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-300 text-sm">No KPI data available yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={sorted}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, name) => [`${v}%`, name === 'performance_score' ? 'Performance' : name === 'kpi_target' ? 'Target' : name]} />
              <Legend formatter={(v) => v === 'performance_score' ? 'Performance' : v === 'kpi_target' ? 'Target' : v} />
              <Bar dataKey="performance_score" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
              <Line type="monotone" dataKey="kpi_target" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* KPI Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Monthly KPI Details</h3>
        </div>
        {kpi.length === 0 && !loading ? (
          <div className="text-center py-10 text-slate-400 text-sm">No KPI records yet. Your manager will add monthly KPI data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Month</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Score</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Target</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Tasks</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Attendance</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {kpi.map(k => (
                  <tr key={k.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{k.month}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center justify-center w-12 h-6 rounded-full text-xs font-bold ${scoreBg(k.performance_score)} ${scoreColor(k.performance_score)}`}>
                        {k.performance_score}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-xs text-slate-500">{k.kpi_target}%</td>
                    <td className="px-4 py-3.5 text-center text-sm text-slate-600">{k.tasks_completed}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-medium ${scoreColor(k.attendance_pct)}`}>{k.attendance_pct}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{k.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
