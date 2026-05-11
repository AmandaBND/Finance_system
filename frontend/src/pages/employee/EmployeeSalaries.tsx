import { useState, useEffect } from 'react'
import { employeeSelfApi as employeeApi } from '../../services/api'
import { Download, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: any = {
  Paid: 'bg-emerald-100 text-emerald-700',
  Pending: 'bg-amber-100 text-amber-700',
}

export default function EmployeeSalaries() {
  const [salaries, setSalaries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')

  useEffect(() => { load() }, [filterMonth])

  async function load() {
    setLoading(true)
    try {
      const res = await employeeApi.salaries(filterMonth ? { month: filterMonth } : undefined)
      setSalaries(res.data)
    } catch { toast.error('Failed to load salaries') }
    finally { setLoading(false) }
  }

  async function downloadSlip(id: number, month: string) {
    try {
      const res = await employeeApi.downloadSlip(id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `SalarySlip-${month}.pdf`; a.click()
      toast.success('Downloading...')
    } catch { toast.error('Download failed') }
  }

  const totalEarned = salaries.filter(s => s.status === 'Paid').reduce((sum, s) => sum + Number(s.net_salary), 0)
  const totalBonuses = salaries.filter(s => s.status === 'Paid').reduce((sum, s) => sum + Number(s.bonuses || 0), 0)

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Salary History</h1>
          <p className="text-sm text-slate-500 mt-0.5">All your salary payments and pay slips</p>
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 text-slate-600"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Total Payments</p>
          <p className="text-xl font-bold text-slate-700 mt-1">{salaries.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Total Earned</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">Rs. {totalEarned.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={12} className="text-amber-500" />
            <p className="text-xs text-slate-500">Total Bonuses</p>
          </div>
          <p className="text-xl font-bold text-amber-600 mt-1">Rs. {totalBonuses.toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Month</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Basic</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Bonuses</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Deductions</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Net Salary</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Currency</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Slip</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              ) : salaries.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No salary records found</td></tr>
              ) : salaries.map(s => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{s.payment_month}</td>
                  <td className="px-4 py-3.5 text-sm text-slate-600 text-right">Rs. {Number(s.base_salary).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-sm text-emerald-600 text-right">
                    {Number(s.bonuses || 0) > 0 ? `+ Rs. ${Number(s.bonuses).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-red-500 text-right">
                    {Number(s.deductions || 0) > 0 ? `- Rs. ${Number(s.deductions).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-bold text-slate-800 text-right">Rs. {Number(s.net_salary).toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-mono">{s.currency || 'LKR'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-600'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {s.status === 'Paid' ? (
                      <button
                        onClick={() => downloadSlip(s.id, s.payment_month)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-colors font-medium"
                      >
                        <Download size={12} /> PDF
                      </button>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
