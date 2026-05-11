import { useState, useEffect } from 'react'
import { revenueApi, formatCurrency, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from '../services/api'
import { Plus, Search, Edit2, Trash2, X, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_COLORS: any = { Paid: 'bg-emerald-100 text-emerald-700', Pending: 'bg-amber-100 text-amber-700', Overdue: 'bg-red-100 text-red-700' }
const EMPTY = { client_name: '', project_name: '', service_type: '', invoice_number: '', invoice_date: format(new Date(), 'yyyy-MM-dd'), due_date: '', amount: '', payment_status: 'Pending', payment_method: '', is_recurring: 0, billing_cycle: 'One-time', notes: '', currency: 'LKR' }

function CurrencySelector({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>
      {SUPPORTED_CURRENCIES.map(c => (
        <option key={c} value={c}>{c} — {CURRENCY_SYMBOLS[c]}</option>
      ))}
    </select>
  )
}

export default function Revenue() {
  const [records, setRecords] = useState<any[]>([])
  const [stats, setStats] = useState<any>({})
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)

  useEffect(() => { load() }, [filterStatus, search])

  async function load() {
    const [r, s] = await Promise.all([revenueApi.list({ status: filterStatus, search }), revenueApi.stats()])
    setRecords(r.data)
    setStats(s.data)
  }

  function openNew() { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(r: any) { setEditing(r); setForm({ ...r, currency: r.currency || 'LKR' }); setModal(true) }

  async function save() {
    try {
      if (editing) await revenueApi.update(editing.id, form)
      else await revenueApi.create(form)
      toast.success(editing ? 'Updated' : 'Revenue added')
      setModal(false); load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  async function del(r: any) {
    if (!confirm('Delete this revenue entry?')) return
    await revenueApi.delete(r.id); toast.success('Deleted'); load()
  }

  const totalPaid = records.filter(r => r.payment_status === 'Paid').reduce((s, r) => s + r.amount, 0)
  const totalPending = records.filter(r => r.payment_status === 'Pending').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Total Received</p><p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalPaid)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Pending</p><p className="text-xl font-bold text-amber-500 mt-1">{formatCurrency(totalPending)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Total Records</p><p className="text-xl font-bold text-slate-700 mt-1">{records.length}</p></div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select className="input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {['Paid','Pending','Overdue'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Add Revenue</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="table-header text-left">Client</th>
              <th className="table-header text-left">Project</th>
              <th className="table-header text-left">Service</th>
              <th className="table-header text-left">Invoice Date</th>
              <th className="table-header text-center">Currency</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header text-left">Method</th>
              <th className="table-header text-center">Status</th>
              <th className="table-header text-center">Recurring</th>
              <th className="table-header text-center">Actions</th>
            </tr></thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">No revenue records found</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-medium">{r.client_name}</td>
                  <td className="table-cell text-slate-500">{r.project_name || '-'}</td>
                  <td className="table-cell text-slate-500">{r.service_type || '-'}</td>
                  <td className="table-cell text-xs text-slate-400">{r.invoice_date}</td>
                  <td className="table-cell text-center"><span className="badge bg-slate-100 text-slate-700 font-mono">{r.currency || 'LKR'}</span></td>
                  <td className="table-cell text-right font-semibold text-slate-700">
                    {CURRENCY_SYMBOLS[r.currency] || 'Rs.'} {Number(r.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="table-cell text-xs text-slate-400">{r.payment_method || '-'}</td>
                  <td className="table-cell text-center"><span className={`badge ${STATUS_COLORS[r.payment_status]}`}>{r.payment_status}</span></td>
                  <td className="table-cell text-center">{r.is_recurring ? <span className="badge bg-purple-100 text-purple-700">{r.billing_cycle}</span> : <span className="text-slate-400 text-xs">—</span>}</td>
                  <td className="table-cell">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-primary rounded"><Edit2 size={14} /></button>
                      <button onClick={() => del(r)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold">{editing ? 'Edit Revenue' : 'Add Revenue'}</h2>
              <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-grid">
                <div><label className="label">Client Name *</label><input className="input" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} /></div>
                <div><label className="label">Project Name</label><input className="input" value={form.project_name} onChange={e => setForm({...form, project_name: e.target.value})} /></div>
                <div><label className="label">Service Type</label><input className="input" value={form.service_type} onChange={e => setForm({...form, service_type: e.target.value})} placeholder="e.g. YouTube Management" /></div>
                <div><label className="label">Invoice Number</label><input className="input" value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} /></div>
                <div><label className="label">Invoice Date</label><input className="input" type="date" value={form.invoice_date} onChange={e => setForm({...form, invoice_date: e.target.value})} /></div>
                <div><label className="label">Due Date</label><input className="input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
                <div><label className="label">Currency</label><CurrencySelector value={form.currency || 'LKR'} onChange={v => setForm({...form, currency: v})} /></div>
                <div><label className="label">Amount ({CURRENCY_SYMBOLS[form.currency] || 'Rs.'}) *</label><input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                <div><label className="label">Payment Status</label>
                  <select className="input" value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value})}>
                    {['Pending','Paid','Overdue'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label">Payment Method</label>
                  <select className="input" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="">Select...</option>
                    {['Bank Transfer','PayPal','Stripe','Cash','Crypto','Other'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label">Billing Cycle</label>
                  <select className="input" value={form.billing_cycle} onChange={e => setForm({...form, billing_cycle: e.target.value, is_recurring: e.target.value !== 'One-time' ? 1 : 0})}>
                    {['One-time','Monthly','Quarterly','Annual'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-full"><label className="label">Notes</label><textarea className="input h-16 resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={save} className="btn-primary">{editing ? 'Update' : 'Add Revenue'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
