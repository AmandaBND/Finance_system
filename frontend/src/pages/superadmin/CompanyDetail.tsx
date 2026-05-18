import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { superadminApi } from '../../services/api'
import { formatLocalDateTime } from '../../lib/dateTime'

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [note, setNote] = useState('')
  const [newPlan, setNewPlan] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [pwd, setPwd] = useState('')

  function load() {
    if (!id) return
    superadminApi.company(id).then(r => {
      setData(r.data)
      setNewPlan(r.data.company?.plan || '')
      setNewStatus(r.data.company?.status || '')
    }).catch(() => navigate('/superadmin'))
  }

  useEffect(() => { load() }, [id, navigate])

  async function savePatch() {
    if (!id) return
    try {
      const body: { plan?: string; status?: string } = {}
      if (newPlan) body.plan = newPlan
      if (newStatus) body.status = newStatus
      await superadminApi.patchCompany(id, body)
      toast.success('Updated')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    }
  }

  async function addNote() {
    if (!id || !note.trim()) return
    try {
      await superadminApi.addNote(id, note.trim())
      setNote('')
      toast.success('Note added')
      load()
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    }
  }

  async function resetPwd() {
    if (!id || pwd.length < 8) { toast.error('Password min 8 chars'); return }
    try {
      await superadminApi.resetOwnerPassword(id, pwd)
      toast.success('Owner password reset')
      setPwd('')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed')
    }
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading…</div>
  }

  const { company, users, stats, logins, notes } = data

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/superadmin" className="text-sm text-indigo-600 font-medium">← Companies</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-4">{company.name}</h1>
        <p className="text-slate-600 text-sm">{company.email} · {company.plan} · {company.status}</p>

        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h2 className="font-semibold mb-2">Usage</h2>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>Invoices: {stats?.invoices}</li>
              <li>Clients: {stats?.clients}</li>
              <li>Employees: {stats?.employees}</li>
              <li>Expenses: {stats?.expenses}</li>
            </ul>
          </div>
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h2 className="font-semibold mb-2">Actions</h2>
            <div className="flex flex-wrap gap-2 mb-2">
              <select className="border rounded-md text-sm px-2 py-1" value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                <option value="free">free</option>
                <option value="professional">professional</option>
                <option value="business">business</option>
                <option value="enterprise">enterprise</option>
              </select>
              <select className="border rounded-md text-sm px-2 py-1" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="cancelled">cancelled</option>
              </select>
              <button type="button" onClick={savePatch} className="bg-slate-900 text-white text-sm px-3 py-1 rounded-md">Save</button>
            </div>
            <div className="flex gap-2 items-center">
              <input type="password" className="border rounded-md text-sm px-2 py-1 flex-1" placeholder="New owner password" value={pwd} onChange={e => setPwd(e.target.value)} />
              <button type="button" onClick={resetPwd} className="text-sm bg-amber-600 text-white px-3 py-1 rounded-md">Reset</button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4 shadow-sm mt-6">
          <h2 className="font-semibold mb-2">Users</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 text-xs"><th className="pb-2">Email</th><th>Name</th><th>Role</th><th>Last login</th></tr></thead>
            <tbody>
              {(users || []).map((u: any) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="py-2">{u.email}</td>
                  <td>{u.name}</td>
                  <td>{u.role}</td>
                  <td className="text-xs text-slate-500">{u.last_login_at ? formatLocalDateTime(u.last_login_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg border p-4 shadow-sm mt-6">
          <h2 className="font-semibold mb-2">Recent logins</h2>
          <ul className="text-xs text-slate-600 space-y-1">
            {(logins || []).map((l: any) => (
              <li key={l.id}>{l.email} — {formatLocalDateTime(l.created_at)} — {l.ip || '—'}</li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg border p-4 shadow-sm mt-6">
          <h2 className="font-semibold mb-2">Notes</h2>
          <div className="flex gap-2 mb-3">
            <input className="flex-1 border rounded-md px-3 py-2 text-sm" value={note} onChange={e => setNote(e.target.value)} placeholder="Add internal note" />
            <button type="button" onClick={addNote} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-md">Add</button>
          </div>
          <ul className="text-sm text-slate-600 space-y-2">
            {(notes || []).map((n: any) => (
              <li key={n.id} className="border-b border-slate-50 pb-2">{n.note}<span className="text-xs text-slate-400 block mt-1">{n.created_at}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
