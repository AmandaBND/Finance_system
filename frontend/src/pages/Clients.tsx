import { useState, useEffect } from 'react'
import { clientApi, portalAdminApi } from '../services/api'
import { Plus, Edit2, Trash2, X, Search, ShieldCheck, ShieldOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const EMPTY = { name: '', email: '', phone: '', company: '', address: '', country: 'Sri Lanka', notes: '' }

export default function Clients() {
  const [clients, setClients] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [portalStatus, setPortalStatus] = useState<Record<number, boolean>>({})
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    const r = await clientApi.list()
    setClients(r.data)
    // Load portal credential status
    try {
      const credRes = await portalAdminApi.credentials()
      const statusMap: Record<number, boolean> = {}
      credRes.data.forEach((c: any) => { statusMap[c.client_id] = !!c.is_active })
      setPortalStatus(statusMap)
    } catch {}
  }

  function openNew() { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(c: any) { setEditing(c); setForm(c); setModal(true) }

  async function save() {
    try {
      if (editing) await clientApi.update(editing.id, form)
      else await clientApi.create(form)
      toast.success(editing ? 'Client updated' : 'Client added')
      setModal(false); load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  async function del(c: any) {
    if (!confirm(`Delete client ${c.name}?`)) return
    await clientApi.delete(c.id); toast.success('Deleted'); load()
  }

  const filtered = clients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.company?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Add Client</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50 border-b border-slate-100">
              <th className="table-header text-left">Name</th>
              <th className="table-header text-left">Company</th>
              <th className="table-header text-left">Email</th>
              <th className="table-header text-left">Phone</th>
              <th className="table-header text-left">Country</th>
              <th className="table-header text-center">Portal</th>
              <th className="table-header text-center">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-12 text-slate-400">No clients found</td></tr>
                : filtered.map(c => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell font-medium">{c.name}</td>
                    <td className="table-cell text-slate-500">{c.company || '-'}</td>
                    <td className="table-cell text-sm text-slate-500">{c.email || '-'}</td>
                    <td className="table-cell text-sm text-slate-400">{c.phone || '-'}</td>
                    <td className="table-cell text-sm text-slate-400">{c.country || '-'}</td>
                    <td className="table-cell text-center">
                      {c.id in portalStatus ? (
                        <button
                          onClick={() => navigate('/settings', { state: { tab: 'portal' } })}
                          title="Manage portal access"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${portalStatus[c.id] ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        >
                          {portalStatus[c.id] ? <><ShieldCheck size={11} /> Active</> : <><ShieldOff size={11} /> Disabled</>}
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate('/settings', { state: { tab: 'portal' } })}
                          className="text-xs text-slate-400 hover:text-indigo-600 underline"
                        >
                          No access
                        </button>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-center gap-1.5">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-primary rounded"><Edit2 size={14} /></button>
                        <button onClick={() => del(c)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
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
              <h2 className="text-lg font-bold">{editing ? 'Edit Client' : 'Add Client'}</h2>
              <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-grid">
                <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><label className="label">Company</label><input className="input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div><label className="label">Country</label><input className="input" value={form.country} onChange={e => setForm({...form, country: e.target.value})} /></div>
                <div className="form-full"><label className="label">Address</label><textarea className="input h-16 resize-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
                <div className="form-full"><label className="label">Notes</label><textarea className="input h-14 resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={save} className="btn-primary">{editing ? 'Update' : 'Add Client'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
