import { useState, useEffect } from 'react'
import { recurringApi, formatCurrency, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from '../services/api'
import { Plus, Edit2, Trash2, X, CheckCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

const TYPE_COLORS: any = { Income: 'bg-emerald-100 text-emerald-700', Expense: 'bg-red-100 text-red-600' }
const EMPTY = { name: '', type: 'Expense', category: '', billing_cycle: 'Monthly', amount: '', currency: 'LKR', next_payment_date: format(new Date(), 'yyyy-MM-dd'), auto_renewal: 1, client_vendor: '', email: '', reminder_days: 3, notes: '', status: 'Active' }

function CurrencySelector({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>
      {SUPPORTED_CURRENCIES.map(c => (
        <option key={c} value={c}>{c} — {CURRENCY_SYMBOLS[c]}</option>
      ))}
    </select>
  )
}

export default function RecurringPayments() {
  const [records, setRecords] = useState<any[]>([])
  const [filterType, setFilterType] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)

  useEffect(() => { load() }, [filterType])

  async function load() {
    const r = await recurringApi.list({ type: filterType })
    setRecords(r.data)
  }

  function openNew() { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(r: any) { setEditing(r); setForm({ ...r, currency: r.currency || 'LKR' }); setModal(true) }

  async function save() {
    try {
      if (editing) await recurringApi.update(editing.id, form)
      else await recurringApi.create(form)
      toast.success(editing ? 'Updated' : 'Recurring payment added')
      setModal(false); load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  async function process(r: any) {
    try {
      const res = await recurringApi.process(r.id)
      toast.success(`Processed. Next: ${res.data.next_payment_date}`)
      load()
    } catch { toast.error('Error') }
  }

  async function del(r: any) {
    if (!confirm('Delete this recurring payment?')) return
    await recurringApi.delete(r.id); toast.success('Deleted'); load()
  }

  const totalIncome = records.filter(r => r.type === 'Income' && r.status === 'Active').reduce((s, r) => s + r.amount, 0)
  const totalExpense = records.filter(r => r.type === 'Expense' && r.status === 'Active').reduce((s, r) => s + r.amount, 0)
  const monthly = {
    income: records.filter(r => r.type === 'Income' && r.status === 'Active' && r.billing_cycle === 'Monthly').reduce((s, r) => s + r.amount, 0),
    expense: records.filter(r => r.type === 'Expense' && r.status === 'Active' && r.billing_cycle === 'Monthly').reduce((s, r) => s + r.amount, 0),
  }

  const dueIn7 = records.filter(r => {
    if (!r.next_payment_date) return false
    const diff = Math.floor((new Date(r.next_payment_date).getTime() - Date.now()) / 86400000)
    return diff >= 0 && diff <= 7
  })

  return (
    <div className="space-y-5 fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-xs text-slate-500">Monthly Recurring Income</p><p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(monthly.income)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Monthly Recurring Expense</p><p className="text-xl font-bold text-red-500 mt-1">{formatCurrency(monthly.expense)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Net Monthly Recurring</p><p className={`text-xl font-bold mt-1 ${monthly.income - monthly.expense >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(monthly.income - monthly.expense)}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Due in 7 Days</p><p className="text-xl font-bold text-amber-500 mt-1">{dueIn7.length} payments</p></div>
      </div>

      {dueIn7.length > 0 && (
        <div className="card p-4 border-l-4 border-amber-400 bg-amber-50">
          <p className="text-sm font-semibold text-amber-700 mb-2">⚠️ Upcoming in 7 Days</p>
          <div className="flex flex-wrap gap-2">
            {dueIn7.map(r => (
              <div key={r.id} className="bg-white rounded-lg px-3 py-2 border border-amber-200 text-xs">
                <span className="font-medium">{r.name}</span> — {r.next_payment_date} — <span className={r.type === 'Income' ? 'text-emerald-600' : 'text-red-500'}>{CURRENCY_SYMBOLS[r.currency] || 'Rs.'} {Number(r.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {['','Income','Expense'].map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === t ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>{t || 'All'}</button>
          ))}
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Add Recurring</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="table-header text-left">Name</th>
              <th className="table-header text-center">Type</th>
              <th className="table-header text-left">Client/Vendor</th>
              <th className="table-header text-center">Cycle</th>
              <th className="table-header text-center">Currency</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header text-left">Next Date</th>
              <th className="table-header text-center">Reminder</th>
              <th className="table-header text-center">Status</th>
              <th className="table-header text-center">Actions</th>
            </tr></thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-slate-400">No recurring payments added yet</td></tr>
              ) : records.map(r => {
                const daysLeft = r.next_payment_date ? Math.floor((new Date(r.next_payment_date).getTime() - Date.now()) / 86400000) : null
                return (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell font-medium">{r.name}{r.category && <span className="text-xs text-slate-400 ml-1">({r.category})</span>}</td>
                    <td className="table-cell text-center"><span className={`badge ${TYPE_COLORS[r.type]}`}>{r.type}</span></td>
                    <td className="table-cell text-slate-500 text-sm">{r.client_vendor || '-'}</td>
                    <td className="table-cell text-center"><span className="badge bg-slate-100 text-slate-600">{r.billing_cycle}</span></td>
                    <td className="table-cell text-center"><span className="badge bg-slate-100 text-slate-700 font-mono">{r.currency || 'LKR'}</span></td>
                    <td className="table-cell text-right font-semibold">
                      {CURRENCY_SYMBOLS[r.currency] || 'Rs.'} {Number(r.amount).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="text-sm">{r.next_payment_date}</p>
                        {daysLeft !== null && <p className={`text-xs ${daysLeft <= 3 ? 'text-red-500 font-medium' : daysLeft <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>{daysLeft === 0 ? 'Today!' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `in ${daysLeft}d`}</p>}
                      </div>
                    </td>
                    <td className="table-cell text-center text-xs text-slate-400">{r.reminder_days}d before</td>
                    <td className="table-cell text-center"><span className={`badge ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status}</span></td>
                    <td className="table-cell">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => process(r)} className="p-1.5 text-slate-400 hover:text-emerald-500 rounded" title="Mark Processed"><CheckCircle size={14} /></button>
                        <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-primary rounded"><Edit2 size={14} /></button>
                        <button onClick={() => del(r)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold">{editing ? 'Edit Recurring' : 'Add Recurring Payment'}</h2>
              <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-grid">
                <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Adobe Creative Cloud" /></div>
                <div><label className="label">Type *</label>
                  <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    <option>Expense</option><option>Income</option>
                  </select>
                </div>
                <div><label className="label">Category</label><input className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Software, Retainer" /></div>
                <div><label className="label">Billing Cycle</label>
                  <select className="input" value={form.billing_cycle} onChange={e => setForm({...form, billing_cycle: e.target.value})}>
                    {['Monthly','Quarterly','Annual','Weekly'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className="label">Currency</label><CurrencySelector value={form.currency || 'LKR'} onChange={v => setForm({...form, currency: v})} /></div>
                <div><label className="label">Amount ({CURRENCY_SYMBOLS[form.currency] || 'Rs.'}) *</label><input className="input" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                <div><label className="label">Next Payment Date</label><input className="input" type="date" value={form.next_payment_date} onChange={e => setForm({...form, next_payment_date: e.target.value})} /></div>
                <div><label className="label">Client / Vendor</label><input className="input" value={form.client_vendor} onChange={e => setForm({...form, client_vendor: e.target.value})} /></div>
                <div><label className="label">Reminder Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Send reminder to..." /></div>
                <div><label className="label">Remind Days Before</label><input className="input" type="number" min="1" max="30" value={form.reminder_days} onChange={e => setForm({...form, reminder_days: e.target.value})} /></div>
                <div><label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <option>Active</option><option>Paused</option><option>Cancelled</option>
                  </select>
                </div>
                <div className="form-full"><label className="label">Notes</label><textarea className="input h-14 resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={save} className="btn-primary">{editing ? 'Update' : 'Add Payment'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
