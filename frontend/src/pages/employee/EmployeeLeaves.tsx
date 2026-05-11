import { useState, useEffect } from 'react'
import { employeeSelfApi as employeeApi } from '../../services/api'
import { CalendarDays, Plus, CheckCircle, Clock, XCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: any = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

const STATUS_ICONS: any = {
  Pending: Clock,
  Approved: CheckCircle,
  Rejected: XCircle,
}

export default function EmployeeLeaves() {
  const [data, setData] = useState<any>({ balance: null, requests: [] })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ leave_type: 'Annual', start_date: '', end_date: '', reason: '' })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await employeeApi.leaves()
      setData(res.data)
    } catch { toast.error('Failed to load leave data') }
    finally { setLoading(false) }
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!form.start_date || !form.end_date) { toast.error('Select start and end dates'); return }
    if (new Date(form.end_date) < new Date(form.start_date)) { toast.error('End date must be after start date'); return }
    setSubmitting(true)
    try {
      await employeeApi.requestLeave(form)
      toast.success('Leave request submitted! Admin will review shortly.')
      setShowForm(false)
      setForm({ leave_type: 'Annual', start_date: '', end_date: '', reason: '' })
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit request')
    } finally { setSubmitting(false) }
  }

  const lb = data.balance || {}

  function calcDays() {
    if (!form.start_date || !form.end_date) return 0
    const diff = new Date(form.end_date).getTime() - new Date(form.start_date).getTime()
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1)
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Leave Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">View your leave balance and submit requests</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors">
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancel' : 'Request Leave'}
        </button>
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Annual Leave', used: lb.annual_used || 0, total: lb.annual_total || 14, color: 'emerald', barColor: 'bg-emerald-500' },
          { label: 'Sick Leave', used: lb.sick_used || 0, total: lb.sick_total || 7, color: 'blue', barColor: 'bg-blue-500' },
          { label: 'Casual Leave', used: lb.casual_used || 0, total: lb.casual_total || 3, color: 'purple', barColor: 'bg-purple-500' },
        ].map(l => {
          const remaining = l.total - l.used
          const pct = Math.min(100, (l.used / l.total) * 100)
          return (
            <div key={l.label} className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={14} className={`text-${l.color}-500`} />
                <p className="text-xs font-semibold text-slate-600">{l.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-700">{remaining} <span className="text-sm font-normal text-slate-400">/ {l.total}</span></p>
              <p className="text-xs text-slate-400 mt-0.5 mb-2">days remaining</p>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${l.barColor} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{l.used} used this year</p>
            </div>
          )
        })}
      </div>

      {/* Request Leave Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">New Leave Request</h3>
          <form onSubmit={submitRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Leave Type</label>
                <select
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={form.leave_type}
                  onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
                >
                  <option value="Annual">Annual Leave</option>
                  <option value="Sick">Sick Leave</option>
                  <option value="Casual">Casual Leave</option>
                </select>
              </div>
              <div className="flex items-end">
                {form.start_date && form.end_date && (
                  <div className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-emerald-600 font-medium">{calcDays()} day(s) requested</p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Start Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">End Date</label>
                <input
                  type="date"
                  required
                  min={form.start_date || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason (optional)</label>
              <textarea
                placeholder="Briefly describe the reason for your leave..."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none h-20"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave History */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Leave Request History</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data.requests.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">No leave requests yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Submitted</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">From</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">To</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Days</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Admin Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((lr: any) => {
                  const Icon = STATUS_ICONS[lr.status] || Clock
                  return (
                    <tr key={lr.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {new Date(lr.requested_at).toLocaleDateString('en-LK')}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 font-medium">{lr.leave_type}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{lr.start_date}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{lr.end_date}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-700">{lr.days_count}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lr.status]}`}>
                          <Icon size={10} />
                          {lr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{lr.admin_notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
