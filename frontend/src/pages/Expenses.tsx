import { useState, useEffect } from 'react'
import { expenseApi, formatCurrency, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from '../services/api'
import { Plus, Search, Edit2, Trash2, X, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const CATEGORIES = ['Salaries','Freelancers','Software Tools','Marketing & Ads','Office Expenses','Internet','Equipment','Taxes','Subscriptions','Travel','Content Production','AI Tools','Hosting','Miscellaneous']
const EMPTY = { title: '', category: '', vendor: '', amount: '', payment_date: format(new Date(), 'yyyy-MM-dd'), payment_method: '', is_recurring: 0, billing_cycle: '', notes: '', currency: 'LKR' }

function CurrencySelector({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>
      {SUPPORTED_CURRENCIES.map(c => (
        <option key={c} value={c}>{c} — {CURRENCY_SYMBOLS[c]}</option>
      ))}
    </select>
  )
}

export default function Expenses() {
  const [records, setRecords] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  useEffect(() => { load() }, [filterCat, search])

  async function load() {
    const r = await expenseApi.list({ category: filterCat, search })
    setRecords(r.data)
  }

  function openNew() { setEditing(null); setForm(EMPTY); setReceiptFile(null); setModal(true) }
  function openEdit(r: any) { setEditing(r); setForm({ ...r, currency: r.currency || 'LKR' }); setReceiptFile(null); setModal(true) }

  async function save() {
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v ?? '')))
      if (receiptFile) fd.append('receipt', receiptFile)
      if (editing) await expenseApi.update(editing.id, fd)
      else await expenseApi.create(fd)
      toast.success(editing ? 'Updated' : 'Expense added')
      setModal(false); load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  async function del(r: any) {
    if (!confirm('Delete this expense?')) return
    await expenseApi.delete(r.id); toast.success('Deleted'); load()
  }

  const total = records.reduce((s, r) => s + r.amount, 0)
  const byCategory: any = {}
  records.forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) + r.amount })
  const topCat = Object.entries(byCategory).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3)

  return (
    <div className="space-y-5 fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Total Expenses</p><p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(total)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Total Records</p><p className="text-xl font-bold text-slate-700 mt-1">{records.length}</p></div>
        {topCat.slice(0,2).map(([cat, amt]: any) => (
          <div key={cat} className="card p-4"><p className="text-xs text-slate-500">{cat}</p><p className="text-xl font-bold text-amber-600 mt-1">{formatCurrency(amt)}</p></div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select className="input w-44" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Add Expense</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="table-header text-left">Title</th>
              <th className="table-header text-left">Category</th>
              <th className="table-header text-left">Vendor</th>
              <th className="table-header text-left">Date</th>
              <th className="table-header text-center">Currency</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header text-left">Method</th>
              <th className="table-header text-center">Recurring</th>
              <th className="table-header text-center">Actions</th>
            </tr></thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No expenses found</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-medium">{r.title}</td>
                  <td className="table-cell"><span className="badge bg-slate-100 text-slate-600">{r.category}</span></td>
                  <td className="table-cell text-slate-500">{r.vendor || '-'}</td>
                  <td className="table-cell text-xs text-slate-400">{r.payment_date}</td>
                  <td className="table-cell text-center"><span className="badge bg-slate-100 text-slate-700 font-mono">{r.currency || 'LKR'}</span></td>
                  <td className="table-cell text-right font-semibold text-red-600">
                    {CURRENCY_SYMBOLS[r.currency] || 'Rs.'} {Number(r.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="table-cell text-xs text-slate-400">{r.payment_method || '-'}</td>
                  <td className="table-cell text-center">{r.is_recurring ? <span className="badge bg-purple-100 text-purple-700">{r.billing_cycle || 'Yes'}</span> : '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center justify-center gap-1.5">
                      {r.receipt_path && <a href={r.receipt_path} target="_blank" className="p-1.5 text-slate-400 hover:text-blue-500 rounded"><Receipt size={14} /></a>}
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

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-grid">
                <div><label className="label">Title *</label><input className="input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
                <div><label className="label">Category *</label>
                  <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Vendor</label><input className="input" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} /></div>
                <div><label className="label">Currency</label><CurrencySelector value={form.currency || 'LKR'} onChange={v => setForm({...form, currency: v})} /></div>
                <div><label className="label">Amount ({CURRENCY_SYMBOLS[form.currency] || 'Rs.'}) *</label><input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                <div><label className="label">Payment Date</label><input className="input" type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} /></div>
                <div><label className="label">Payment Method</label>
                  <select className="input" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    <option value="">Select...</option>
                    {['Bank Transfer','Cash','Credit Card','Online','Other'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label">Recurring</label>
                  <select className="input" value={form.billing_cycle || (form.is_recurring ? 'Monthly' : '')} onChange={e => setForm({...form, billing_cycle: e.target.value, is_recurring: e.target.value ? 1 : 0})}>
                    <option value="">One-time</option>
                    {['Monthly','Quarterly','Annual'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Receipt (optional)</label><input className="input" type="file" accept="image/*,.pdf" onChange={e => setReceiptFile(e.target.files?.[0] || null)} /></div>
                <div className="form-full"><label className="label">Notes</label><textarea className="input h-16 resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={save} className="btn-primary">{editing ? 'Update' : 'Add Expense'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
