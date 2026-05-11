import { useState, useEffect } from 'react'
import { portalApi, CURRENCY_SYMBOLS } from '../../services/api'
import { Download, FileCheck, Clock, XCircle, CreditCard, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

const SLIP_STATUS_COLORS: any = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

export default function PortalHistory() {
  const [slips, setSlips] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState('')
  const [activeTab, setActiveTab] = useState<'invoices' | 'slips'>('invoices')

  useEffect(() => { load() }, [filterMonth])

  async function load() {
    setLoading(true)
    try {
      const [invRes, slipRes] = await Promise.all([
        portalApi.invoices({ status: 'Paid', month: filterMonth }),
        portalApi.paymentSlips()
      ])
      setInvoices(invRes.data)
      setSlips(slipRes.data)
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  async function downloadPdf(id: number, number: string) {
    try {
      const res = await portalApi.downloadPdf(id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `Invoice-${number}.pdf`; a.click()
      toast.success('Downloading...')
    } catch { toast.error('Download failed') }
  }

  const sym = (inv: any) => CURRENCY_SYMBOLS[inv?.currency] || 'Rs.'

  const totalPaid = invoices.reduce((s, i) => s + Number(i.total), 0)

  const filteredSlips = filterMonth
    ? slips.filter(s => s.submitted_at?.startsWith(filterMonth))
    : slips

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Payment History</h1>
          <p className="text-sm text-slate-500 mt-0.5">All your paid invoices and submitted payment slips</p>
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-600"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Paid Invoices</p>
          <p className="text-xl font-bold text-slate-700 mt-1">{invoices.length}</p>
          {filterMonth && <p className="text-xs text-slate-400 mt-0.5">in {filterMonth}</p>}
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">Rs. {totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Bank Transfer Slips</p>
          <p className="text-xl font-bold text-slate-700 mt-1">{slips.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {slips.filter(s => s.status === 'Pending').length} pending
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${activeTab === 'invoices' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <FileCheck size={15} /> Paid Invoices
          </button>
          <button
            onClick={() => setActiveTab('slips')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${activeTab === 'slips' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Building2 size={15} /> Payment Slips
            {slips.filter(s => s.status === 'Pending').length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                {slips.filter(s => s.status === 'Pending').length}
              </span>
            )}
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === 'invoices' ? (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Issue Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Paid Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Currency</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Download</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      No paid invoices {filterMonth ? `in ${filterMonth}` : 'yet'}
                    </td>
                  </tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">#{inv.invoice_number}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{inv.issue_date}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {inv.paid_date ? (
                        <span className="text-emerald-600 font-medium">{inv.paid_date}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-mono">{inv.currency || 'LKR'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold text-emerald-700 text-right">
                      {sym(inv)} {Number(inv.total).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => downloadPdf(inv.id, inv.invoice_number)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                      >
                        <Download size={12} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Submitted</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Reference</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Amount</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Admin Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-sm">
                      No payment slips submitted {filterMonth ? `in ${filterMonth}` : 'yet'}
                    </td>
                  </tr>
                ) : filteredSlips.map(slip => (
                  <tr key={slip.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">#{slip.invoice_number || '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {slip.submitted_at ? new Date(slip.submitted_at).toLocaleDateString('en-LK') : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{slip.reference || '—'}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-800 text-right">
                      {CURRENCY_SYMBOLS[slip.currency] || 'Rs.'} {Number(slip.amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${SLIP_STATUS_COLORS[slip.status] || 'bg-slate-100 text-slate-600'}`}>
                        {slip.status === 'Pending' && <Clock size={10} />}
                        {slip.status === 'Approved' && <FileCheck size={10} />}
                        {slip.status === 'Rejected' && <XCircle size={10} />}
                        {slip.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{slip.admin_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
