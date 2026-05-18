import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleLogin } from '@react-oauth/google'
import { Lock, Mail, User, Eye, EyeOff, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import LoadingScreen from '../components/LoadingScreen'

export default function CompanyLogin() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'legacy' | 'email'>('legacy')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [transition, setTransition] = useState(false)

  async function finishAuth(res: { data: { token: string; username?: string; user?: { name?: string; email?: string; role?: string }; first_login?: boolean; authType?: string } }) {
    const d = res.data
    localStorage.setItem('admin_token', d.token)
    const display = d.user?.name || d.user?.email || d.username || 'Admin'
    localStorage.setItem('admin_user', display)
    const role = d.authType === 'legacy_admin' ? 'admin' : (d.user?.role || 'owner')
    localStorage.setItem('admin_auth_role', role)
    if (d.first_login) localStorage.setItem('admin_first_login', '1')
    else localStorage.removeItem('admin_first_login')
    setTransition(true)
    await new Promise(r => setTimeout(r, 1800))
    setTransition(false)
    if (d.first_login) navigate('/onboarding/plans', { replace: true })
    else navigate('/app/dashboard', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'legacy') {
      if (!username || !password) { toast.error('Enter username and password'); return }
    } else {
      if (!email || !password) { toast.error('Enter email and password'); return }
    }
    setLoading(true)
    try {
      const body = mode === 'legacy' ? { username, password } : { email, password }
      const res = await authApi.login(body)
      await finishAuth(res)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle(credential: string) {
    setLoading(true)
    try {
      const res = await authApi.googleAuth(credential)
      await finishAuth(res)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Google sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-sans">
      <AnimatePresence>
        {transition && <LoadingScreen title="Setting up your workspace…" />}
      </AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#1E3A5F] rounded-xl mb-4 shadow-lg">
            <BarChart2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1E3A5F]">GroovyMark Finance</h1>
          <p className="text-slate-600 text-sm mt-1">Sign in to your workspace</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm">
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <div className="flex justify-center mb-6">
              <GoogleLogin
                onSuccess={c => c.credential && onGoogle(c.credential)}
                onError={() => toast.error('Google sign-in failed')}
              />
            </div>
          )}
          <p className="text-center text-xs text-slate-500 mb-4">or continue with {mode === 'legacy' ? 'username' : 'email'}</p>

          <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm mb-4">
            <button type="button" className={`flex-1 py-2 ${mode === 'legacy' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-slate-600'}`} onClick={() => setMode('legacy')}>Username</button>
            <button type="button" className={`flex-1 py-2 ${mode === 'email' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-slate-600'}`} onClick={() => setMode('email')}>Email</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'legacy' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full border border-slate-200 rounded-md pl-9 pr-4 py-2.5 text-sm"
                    placeholder="admin"
                    autoComplete="username"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Work email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-md pl-9 pr-4 py-2.5 text-sm"
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-md pl-9 pr-10 py-2.5 text-sm"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || transition}
              className="w-full bg-[#1E3A5F] hover:bg-[#152a45] disabled:opacity-60 text-white font-semibold py-2.5 rounded-md text-sm"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-600 mt-6">
          <Link to="/" className="text-[#3B82F6] font-medium">Home</Link>
          {' · '}
          <Link to="/signup" className="text-[#3B82F6] font-medium">Create workspace</Link>
        </p>
      </motion.div>
    </div>
  )
}
