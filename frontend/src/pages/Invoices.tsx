import { useState, useEffect } from 'react'
import { invoiceApi, clientApi, formatCurrency, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from '../services/api'
import { Plus, Search, Send, CheckCircle, Download, Trash2, Edit2, X, Building2, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const EMPTY_ITEM = { description: '', quantity: 1, unit_price: 0, amount: 0 }
const STATUS_COLORS: any = { Draft: 'bg-slate-100 text-slate-600', Sent: 'bg-blue-100 text-blue-700', Paid: 'bg-emerald-100 text-emerald-700', Overdue: 'bg-red-100 text-red-700', Cancelled: 'bg-gray-100 text-gray-500' }

function CurrencySelector({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>
      {SUPPORTED_CURRENCIES.map(c => (
        <option key={c} value={c}>{c} — {CURRENCY_SYMBOLS[c]}</option>
      ))}
    </select>
  )
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState<any>(null)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({
    client_name: '', client_email: '', client_address: '', client_company: '',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
    items: [{ ...EMPTY_ITEM }], tax_rate: 0, discount: 0, notes: '', terms: '', status: 'Draft',
    currency: 'LKR', payment_methods: 'bank'
  })

  useEffect(() => { load() }, [filterStatus, search])

  async function load() {
    const [invRes, clRes] = await Promise.all([invoiceApi.list({ status: filterStatus, search }), clientApi.list()])
    setInvoices(invRes.data)
    setClients(clRes.data)
  }

  function openNew() {
    setEditing(null)
    setForm({ client_name: '', client_email: '', client_address: '', client_company: '', issue_date: format(new Date(), 'yyyy-MM-dd'), due_date: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'), items: [{ ...EMPTY_ITEM }], tax_rate: 0, discount: 0, notes: '', terms: '', status: 'Draft', currency: 'LKR', payment_methods: 'bank' })
    setModal(true)
  }

  function openEdit(inv: any) {
    setEditing(inv)
    setForm({ ...inv, items: inv.items || [{ ...EMPTY_ITEM }] })
    setModal(true)
  }

  function setClientFromSelect(clientId: string) {
    const c = clients.find(cl => cl.id === parseInt(clientId))
    if (c) setForm((f: any) => ({ ...f, client_id: c.id, client_name: c.name, client_email: c.email || '', client_address: c.address || '', client_company: c.company || '' }))
  }

  function updateItem(idx: number, field: string, val: any) {
    const items = [...form.items]
    items[idx] = { ...items[idx], [field]: val }
    if (field === 'quantity' || field === 'unit_price') {
      items[idx].amount = parseFloat(items[idx].quantity || 0) * parseFloat(items[idx].unit_price || 0)
    }
    setForm((f: any) => ({ ...f, items }))
  }

  function addItem() { setForm((f: any) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] })) }
  function removeItem(idx: number) { setForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) })) }

  const subtotal = form.items.reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0)
  const taxAmt = subtotal * (parseFloat(form.tax_rate) || 0) / 100
  const total = subtotal + taxAmt - (parseFloat(form.discount) || 0)

  async function save() {
    try {
      if (editing) await invoiceApi.update(editing.id, { ...form, subtotal, tax_amount: taxAmt, total })
      else await invoiceApi.create({ ...form, subtotal, tax_amount: taxAmt, total })
      toast.success(editing ? 'Invoice updated' : 'Invoice created')
      setModal(false)
      load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  async function sendInvoice(inv: any) {
    const t = toast.loading('Sending to client portal...')
    try {
      const res = await invoiceApi.send(inv.id)
      if (res.data.emailSent) {
        toast.success('Invoice sent to portal & emailed!', { id: t })
      } else {
        toast.success('Invoice published to client portal ✓', { id: t })
        if (inv.client_email) toast('Email delivery failed — check SMTP settings in Settings > Email', { icon: '⚠️' })
      }
      load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Send failed', { id: t }) }
  }

  function togglePaymentMethod(method: 'bank' | 'online') {
    const current = form.payment_methods || 'bank'
    const hasBank = current === 'bank' || current === 'both'
    const hasOnline = current === 'online' || current === 'both'
    let next: string
    if (method === 'bank') {
      const newBank = !hasBank
      next = newBank && hasOnline ? 'both' : newBank ? 'bank' : hasOnline ? 'online' : 'bank'
    } else {
      const newOnline = !hasOnline
      next = hasBank && newOnline ? 'both' : newOnline ? 'online' : hasBank ? 'bank' : 'bank'
    }
    setForm((f: any) => ({ ...f, payment_methods: next }))
  }

  async function markPaid(inv: any) {
    try {
      await invoiceApi.markPaid(inv.id)
      toast.success('Marked as paid ✅ Revenue recorded automatically')
      load()
    } catch { toast.error('Error') }
  }

  async function downloadPdf(inv: any) {
    try {
      const res = await invoiceApi.downloadPdf(inv.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `Invoice-${inv.invoice_number}.pdf`; a.click()
    } catch { toast.error('Download failed') }
  }

  async function del(inv: any) {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return
    await invoiceApi.delete(inv.id)
    toast.success('Deleted')
    load()
  }

  return (
    <div className="space-y-5 fade-in">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {['Draft','Sent','Paid','Overdue','Cancelled'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> New Invoice</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="table-header text-left">Invoice #</th>
              <th className="table-header text-left">Client</th>
              <th className="table-header text-left">Issue Date</th>
              <th className="table-header text-left">Due Date</th>
              <th className="table-header text-center">Currency</th>
              <th className="table-header text-right">Total</th>
              <th className="table-header text-center">Status</th>
              <th className="table-header text-center">Actions</th>
            </tr></thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400">No invoices found</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="table-row">
                  <td className="table-cell font-mono text-xs text-primary font-semibold">{inv.invoice_number}</td>
                  <td className="table-cell"><p className="font-medium text-slate-700">{inv.client_name}</p><p className="text-xs text-slate-400">{inv.client_email}</p></td>
                  <td className="table-cell text-xs text-slate-500">{inv.issue_date}</td>
                  <td className="table-cell text-xs text-slate-500">{inv.due_date}</td>
                  <td className="table-cell text-center"><span className="badge bg-slate-100 text-slate-700 font-mono">{inv.currency || 'LKR'}</span></td>
                  <td className="table-cell text-right font-semibold">{inv.currency_symbol || 'Rs.'} {Number(inv.total).toLocaleString('en-LK', {minimumFractionDigits: 2})}</td>
                  <td className="table-cell text-center"><span className={`badge ${STATUS_COLORS[inv.status]}`}>{inv.status}</span></td>
                  <td className="table-cell">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openEdit(inv)} className="p-1.5 text-slate-400 hover:text-primary rounded"><Edit2 size={14} /></button>
                      {inv.status !== 'Paid' && inv.client_email && <button onClick={() => sendInvoice(inv)} className="p-1.5 text-slate-400 hover:text-blue-500 rounded" title="Send"><Send size={14} /></button>}
                      {inv.status !== 'Paid' && <button onClick={() => markPaid(inv)} className="p-1.5 text-slate-400 hover:text-emerald-500 rounded" title="Mark Paid"><CheckCircle size={14} /></button>}
                      <button onClick={() => downloadPdf(inv)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Download PDF"><Download size={14} /></button>
                      <button onClick={() => del(inv)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-content max-w-3xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">{editing ? 'Edit Invoice' : 'New Invoice'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Client select */}
              <div>
                <label className="label">Select Existing Client</label>
                <select className="input" onChange={e => setClientFromSelect(e.target.value)} defaultValue="">
                  <option value="">-- Select client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.email ? `(${c.email})` : ''}</option>)}
                </select>
              </div>
              <div className="form-grid">
                <div><label className="label">Client Name *</label><input className="input" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} /></div>
                <div><label className="label">Client Email</label><input className="input" type="email" value={form.client_email} onChange={e => setForm({...form, client_email: e.target.value})} /></div>
                <div><label className="label">Company</label><input className="input" value={form.client_company} onChange={e => setForm({...form, client_company: e.target.value})} /></div>
                <div><label className="label">Address</label><input className="input" value={form.client_address} onChange={e => setForm({...form, client_address: e.target.value})} /></div>
                <div><label className="label">Issue Date</label><input className="input" type="date" value={form.issue_date} onChange={e => setForm({...form, issue_date: e.target.value})} /></div>
                <div><label className="label">Due Date</label><input className="input" type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
                <div><label className="label">Currency</label><CurrencySelector value={form.currency || 'LKR'} onChange={v => setForm({...form, currency: v})} /></div>
              </div>

              {/* Items */}
              <div>
                <label className="label">Invoice Items</label>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-50"><th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Description</th><th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-20">Qty</th><th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-32">Unit Price</th><th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-32">Amount</th><th className="w-10"></th></tr></thead>
                    <tbody>
                      {form.items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-3 py-2"><input className="input" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Service description" /></td>
                          <td className="px-3 py-2"><input className="input text-center" type="number" min="1" step="0.5" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} /></td>
                          <td className="px-3 py-2"><input className="input text-right" type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} /></td>
                          <td className="px-3 py-2 text-right text-slate-700 font-medium">{formatCurrency(item.amount)}</td>
                          <td className="px-2"><button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-red-400"><X size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                    <button onClick={addItem} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus size={12} /> Add Item</button>
                  </div>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Subtotal:</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                  <div className="flex items-center justify-between gap-2"><span className="text-slate-500">Tax (%):</span><input className="input w-20 text-right" type="number" min="0" max="100" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: e.target.value})} /></div>
                  <div className="flex items-center justify-between gap-2"><span className="text-slate-500">Discount:</span><input className="input w-28 text-right" type="number" min="0" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} /></div>
                  <div className="flex justify-between border-t pt-2 font-bold text-base"><span>Total:</span><span className="text-primary">{formatCurrency(total)}</span></div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-2">
                <label className="label mb-1">Client Payment Options <span className="text-slate-400 font-normal">(shown on client portal)</span></label>
                <div className="flex gap-5">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-indigo-600"
                      checked={form.payment_methods === 'bank' || form.payment_methods === 'both'}
                      onChange={() => togglePaymentMethod('bank')}
                    />
                    <Building2 size={14} className="text-slate-500" />
                    <span className="text-sm text-slate-700">Bank Transfer</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-indigo-600"
                      checked={form.payment_methods === 'online' || form.payment_methods === 'both'}
                      onChange={() => togglePaymentMethod('online')}
                    />
                    <CreditCard size={14} className="text-slate-500" />
                    <span className="text-sm text-slate-700">Online Payment (PayHere)</span>
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <div><label className="label">Notes</label><textarea className="input h-20 resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
                <div><label className="label">Terms</label><textarea className="input h-20 resize-none" value={form.terms} onChange={e => setForm({...form, terms: e.target.value})} /></div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <select className="input w-36" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  {['Draft','Sent','Paid'].map(s => <option key={s}>{s}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={save} className="btn-primary">{editing ? 'Update' : 'Create Invoice'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
