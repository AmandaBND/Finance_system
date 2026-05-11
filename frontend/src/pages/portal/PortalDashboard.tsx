import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { portalApi, CURRENCY_SYMBOLS } from '../../services/api'
import { TrendingUp, Clock, AlertCircle, Download, CreditCard, CheckCircle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const STATUS_COLORS: any = {
  Paid: 'bg-emerald-100 text-emerald-700',
  Sent: 'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-700',
  Draft: 'bg-slate-100 text-slate-600',
}

export default function PortalDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await portalApi.dashboard()
      setData(res.data)
    } catch { toast.error('Failed to load dashboard') }
    finally { setLoading(false) }
  }

  async function downloadInvoice(id: number, number: string) {
    try {
      const res = await portalApi.downloadPdf(id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `Invoice-${number}.pdf`; a.click()
    } catch { toast.error('Download failed') }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return null

  const { stats, recentInvoices, overdueInvoices, upcomingInvoices, monthlyChart, pendingSlips } = data
  const sym = (inv: any) => CURRENCY_SYMBOLS[inv.currency] || 'Rs.'

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Overdue alert */}
      {overdueInvoices?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-red-700 text-sm">You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}</p>
            <p className="text-red-600 text-xs mt-0.5">Please settle the outstanding amount to avoid service interruption.</p>
          </div>
          <Link to="/portal/invoices?status=Overdue" className="ml-auto text-xs text-red-600 font-semibold hover:underline shrink-0">View →</Link>
        </div>
      )}

      {/* Pending slip notice */}
      {pendingSlips?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Clock size={18} className="text-amber-500 shrink-0" />
          <p className="text-amber-700 text-sm">{pendingSlips.length} payment slip{pendingSlips.length > 1 ? 's' : ''} pending admin review</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600">Rs. {Number(stats.totalPaid).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-400 mt-1">{stats.invoiceCount} total invoices</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Outstanding</p>
          <p className="text-xl font-bold text-blue-600">Rs. {Number(stats.totalPending).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting payment</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Overdue</p>
          <p className={`text-xl font-bold ${stats.totalOverdue > 0 ? 'text-red-600' : 'text-slate-400'}`}>Rs. {Number(stats.totalOverdue).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-slate-400 mt-1">Past due date</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 mb-1">Next Due</p>
          {upcomingInvoices?.length > 0 ? (
            <>
              <p className="text-xl font-bold text-slate-700">{upcomingInvoices[0].due_date}</p>
              <p className="text-xs text-slate-400 mt-1">#{upcomingInvoices[0].invoice_number}</p>
            </>
          ) : (
            <p className="text-lg font-bold text-slate-300">No upcoming</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Payment History (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthlyChart}>
              <defs>
                <linearGradient id="portalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs.${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [`Rs. ${Number(v).toLocaleString()}`, 'Paid']} />
              <Area type="monotone" dataKey="paid" stroke="#6366f1" fill="url(#portalGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming invoices */}
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Upcoming Due</h3>
          {upcomingInvoices?.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No pending invoices</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">#{inv.invoice_number}</p>
                    <p className="text-xs text-slate-500">Due {inv.due_date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">{sym(inv)} {Number(inv.total).toLocaleString()}</p>
                    <Link to={`/portal/pay/${inv.id}`} className="text-xs text-indigo-600 font-semibold hover:underline">Pay →</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent invoices */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Recent Invoices</h3>
          <Link to="/portal/invoices" className="text-xs text-indigo-600 font-semibold hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-left">Invoice #</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-left">Issue Date</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-left">Due Date</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-right">Amount</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-center">Status</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 text-center">Actions</th>
            </tr></thead>
            <tbody>
              {recentInvoices?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">No invoices yet</td></tr>
              ) : recentInvoices?.map((inv: any) => (
                <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">#{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{inv.issue_date}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{inv.due_date}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{sym(inv)} {Number(inv.total).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-slate-100 text-slate-600'}`}>{inv.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => downloadInvoice(inv.id, inv.invoice_number)} className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg" title="Download PDF"><Download size={13} /></button>
                      {inv.status !== 'Paid' && (
                        <Link to={`/portal/pay/${inv.id}`} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg" title="Pay Now"><CreditCard size={13} /></Link>
                      )}
                    </div>
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
