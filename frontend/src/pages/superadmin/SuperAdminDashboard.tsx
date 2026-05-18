import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { superadminApi } from '../../services/api'
import { formatLocalDateTime } from '../../lib/dateTime'

type Stats = {
  totalCompanies: number
  activeCompanies30d: number
  byPlan: { plan: string; c: number }[]
  totalUsers: number
  signupsThisMonth: number
}

type CompanyRow = {
  id: string
  name: string
  email: string
  plan: string
  status: string
  user_count: number
  last_login: string | null
  created_at: string
}

type Activity = { id?: number; message?: string; event_type?: string; created_at?: string; company_id?: string }

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [q, setQ] = useState('')
  const [plan, setPlan] = useState('')
  const [status, setStatus] = useState('')

  function logout() {
    localStorage.removeItem('superadmin_token')
    navigate('/superadmin/login', { replace: true })
  }

  useEffect(() => {
    superadminApi.stats().then(r => setStats(r.data)).catch(() => navigate('/superadmin/login', { replace: true }))
    superadminApi.activity().then(r => setActivity(r.data || [])).catch(() => {})
    superadminApi.companies({}).then(r => setCompanies(r.data || [])).catch(() => {})
  }, [navigate])

  useEffect(() => {
    const t = setTimeout(() => {
      superadminApi.companies({ q: q || undefined, plan: plan || undefined, status: status || undefined })
        .then(r => setCompanies(r.data || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [q, plan, status])

  const planMax = Math.max(1, ...(stats?.byPlan || []).map(p => p.c))

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Super admin</h1>
          <button type="button" onClick={logout} className="text-sm text-red-600 font-medium">Log out</button>
        </div>

        {stats && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <p className="text-xs text-slate-500">Companies</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalCompanies}</p>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <p className="text-xs text-slate-500">Active (30d)</p>
              <p className="text-2xl font-bold text-emerald-700">{stats.activeCompanies30d}</p>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <p className="text-xs text-slate-500 mb-2">By plan</p>
              <div className="space-y-1">
                {(stats.byPlan || []).map(p => (
                  <div key={p.plan} className="flex items-center gap-2 text-xs">
                    <span className="w-16 truncate">{p.plan}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded" style={{ width: `${(p.c / planMax) * 100}%` }} />
                    </div>
                    <span>{p.c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <p className="text-xs text-slate-500">Total users</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
            </div>
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <p className="text-xs text-slate-500">New (30d)</p>
              <p className="text-2xl font-bold text-slate-900">{stats.signupsThisMonth}</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="p-4 border-b flex flex-wrap gap-3">
              <input className="border rounded-md px-3 py-2 text-sm flex-1 min-w-[160px]" placeholder="Search name or email" value={q} onChange={e => setQ(e.target.value)} />
              <select className="border rounded-md px-2 py-2 text-sm" value={plan} onChange={e => setPlan(e.target.value)}>
                <option value="">All plans</option>
                <option value="free">Free</option>
                <option value="professional">Professional</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <select className="border rounded-md px-2 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="p-3">Company</th>
                    <th className="p-3">Owner email</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Users</th>
                    <th className="p-3">Last login</th>
                    <th className="p-3">Signed up</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map(c => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3 text-slate-600">{c.email}</td>
                      <td className="p-3">{c.plan}</td>
                      <td className="p-3">{c.status}</td>
                      <td className="p-3">{c.user_count}</td>
                      <td className="p-3 text-xs text-slate-500">{c.last_login ? formatLocalDateTime(c.last_login) : '—'}</td>
                      <td className="p-3 text-xs text-slate-500">{c.created_at ? formatLocalDateTime(c.created_at, { dateOnly: true }) : '—'}</td>
                      <td className="p-3">
                        <Link to={`/superadmin/companies/${c.id}`} className="text-indigo-600 font-medium hover:underline">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {companies.length === 0 && <p className="p-8 text-center text-slate-500 text-sm">No companies</p>}
            </div>
          </div>

          <div className="bg-white rounded-lg border shadow-sm p-4">
            <h2 className="font-semibold text-slate-900 mb-3">Activity</h2>
            <ul className="space-y-3 text-xs text-slate-600 max-h-[480px] overflow-y-auto">
              {activity.map((a, i) => (
                <li key={a.id ?? i} className="border-b border-slate-50 pb-2">
                  <p>{a.message || a.event_type}</p>
                  <p className="text-slate-400 mt-0.5">{formatLocalDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
