import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { superadminApi } from '../../services/api'

export default function SuperAdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await superadminApi.login(email, password)
      localStorage.setItem('superadmin_token', res.data.token)
      navigate('/superadmin', { replace: true })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-lg p-8 shadow-xl border border-slate-200">
        <h1 className="text-lg font-bold text-slate-900">Platform operator</h1>
        <p className="text-xs text-slate-500 mt-1 mb-6">Super admin access only</p>
        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
        <input className="w-full border rounded-md px-3 py-2 text-sm mb-4" value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="username" />
        <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
        <input className="w-full border rounded-md px-3 py-2 text-sm mb-4" value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" />
        <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-2.5 rounded-md text-sm font-semibold disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
