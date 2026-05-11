import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { portalApi, CURRENCY_SYMBOLS } from '../../services/api'
import { Download, CreditCard, Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_COLORS: any = {
  Paid: 'bg-emerald-100 text-emerald-700',
  Sent: 'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-700',
  Draft: 'bg-slate-100 text-slate-600',
}

export default function PortalInvoices() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [filterStatus, filterMonth])

  async function load() {
    setLoading(true)
    try {
      const params: any = {}
      if (filterStatus) params.status = filterStatus
      if (filterMonth) params.month = filterMonth
      const res = await portalApi.invoices(params)
      setInvoices(res.data)
    } catch { toast.error('Failed to load invoices') }
    finally { setLoading(false) }
  }

  async function downloadPdf(id: number, number: string) {
    try {
      const res = await portalApi.downloadPdf(id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `Invoice-${number}.pdf`; a.click()
      toast.success('Downloading...')
    } catch { toast.error('Download failed') }
  }

  const filtered = invoices.filter(inv =>
    !search || inv.invoice_number.toLowerCase().includes(search.toLowerCase())
  )

  const sym = (inv: any) => CURRENCY_SYMBOLS[inv.currency] || 'Rs.'

  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + i.total, 0)
  const totalPending = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue').reduce((s, i) => s + i.total, 0)

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Total Invoices</p>
          <p className="text-xl font-bold text-slate-700 mt-1">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Total Paid</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">Rs. {Number(totalPaid).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500">Outstanding</p>
          <p className={`text-xl font-bold mt-1 ${totalPending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>Rs. {Number(totalPending).toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Search invoice #..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-600" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Paid">Paid</option>
          <option value="Sent">Pending</option>
          <option value="Overdue">Overdue</option>
          <option value="Draft">Draft</option>
        </select>
        <input type="month" className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 text-slate-600" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        {(filterStatus || filterMonth || search) && (
          <button onClick={() => { setFilterStatus(''); setFilterMonth(''); setSearch('') }} className="text-xs text-slate-500 hover:text-slate-700 underline">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Invoice #</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Issue Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-left">Due Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Currency</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-right">Amount</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Actions</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12"><div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No invoices found</td></tr>
              ) : filtered.map(inv => (
                <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">#{inv.invoice_number}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{inv.issue_date}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">
                    <span className={inv.status === 'Overdue' ? 'text-red-600 font-medium' : ''}>{inv.due_date}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-mono">{inv.currency || 'LKR'}</span>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-bold text-slate-800 text-right">{sym(inv)} {Number(inv.total).toLocaleString('en-LK', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-slate-100 text-slate-600'}`}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => downloadPdf(inv.id, inv.invoice_number)} className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-colors font-medium">
                        <Download size={12} /> PDF
                      </button>
                      {inv.status !== 'Paid' && inv.status !== 'Draft' && (
                        <Link to={`/portal/pay/${inv.id}`} className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors font-medium">
                          <CreditCard size={12} /> Pay
                        </Link>
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
