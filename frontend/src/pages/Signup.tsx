import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleLogin } from '@react-oauth/google'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import PlanCard from '../components/PlanCard'
import LoadingScreen from '../components/LoadingScreen'

const HEARD = ['Google Search', 'Social Media', 'Friend/Colleague', 'Other']

const planCards: Record<string, { title: string; price: string; limits: string[] }> = {
  free: { title: 'Free', price: 'LKR 0/mo', limits: ['1 user', '10 invoices/mo', '5 clients'] },
  professional: { title: 'Professional', price: 'LKR 4,900/mo', limits: ['3 users', '50 invoices/mo', '25 clients'] },
  business: { title: 'Business', price: 'LKR 12,900/mo', limits: ['10 users', '200 invoices/mo', '100 clients'] },
  enterprise: { title: 'Enterprise', price: 'Custom', limits: ['Unlimited everything'] },
}

function normalizePlan(p: string | null) {
  const x = (p || 'free').toLowerCase()
  return x in planCards ? x : 'free'
}

export default function Signup() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [plan, setPlan] = useState(normalizePlan(params.get('plan')))
  const [company_name, setCompanyName] = useState('')
  const [full_name, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm_password, setConfirmPassword] = useState('')
  const [heard_from, setHeardFrom] = useState('')
  const [otp, setOtp] = useState('')
  const [resendSec, setResendSec] = useState(0)
  const [loading, setLoading] = useState(false)
  const [welcome, setWelcome] = useState(false)

  useEffect(() => {
    setPlan(normalizePlan(params.get('plan')))
  }, [params])

  useEffect(() => {
    if (resendSec <= 0) return
    const t = setInterval(() => setResendSec(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendSec])

  async function submitPlan() {
    setStep(2)
  }

  async function requestOtp() {
    if (!company_name || !full_name || !email || !password) {
      toast.error('Fill all fields')
      return
    }
    if (password !== confirm_password) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.signupRequestOtp({ company_name, full_name, email, password, confirm_password, plan, heard_from: heard_from || undefined })
      toast.success('Verification code sent')
      setStep(3)
      setResendSec(60)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setLoading(true)
    try {
      const res = await authApi.signupVerify(email, otp)
      localStorage.setItem('admin_token', res.data.token)
      localStorage.setItem('admin_auth_role', res.data.user?.role || 'owner')
      localStorage.setItem('admin_user', res.data.user?.name || res.data.user?.email || '')
      localStorage.setItem('admin_first_login', '1')
      setWelcome(true)
      setTimeout(() => navigate('/onboarding/plans', { replace: true }), 2200)
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Invalid code')
    } finally {
      setLoading(false)
    }
  }

  async function googleNewAccount(credential: string) {
    if (!company_name.trim()) {
      toast.error('Enter company name for Google signup')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.googleAuth(credential, { company_name, plan, heard_from: heard_from || undefined })
      localStorage.setItem('admin_token', res.data.token)
      localStorage.setItem('admin_auth_role', res.data.user?.role || 'owner')
      localStorage.setItem('admin_user', res.data.user?.name || '')
      localStorage.setItem('admin_first_login', res.data.first_login ? '1' : '0')
      if (res.data.first_login) navigate('/onboarding/plans', { replace: true })
      else if (!res.data.currency_locked) navigate('/onboarding/currency', { replace: true })
      else navigate('/app/dashboard', { replace: true })
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Google signup failed')
    } finally {
      setLoading(false)
    }
  }

  if (welcome) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] relative">
        <LoadingScreen title="Setting up your workspace…" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-24 left-0 right-0 text-center text-sm text-slate-600 space-y-2 pointer-events-none"
        >
          <p>✓ Creating your account</p>
          <p>✓ Setting up your company</p>
          <p>✓ Configuring your plan</p>
        </motion.div>
      </div>
    )
  }

  const pc = planCards[plan]

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <Link to="/" className="text-sm text-[#1E3A5F] font-medium">← Back</Link>
        <h1 className="text-2xl font-bold text-[#1E3A5F] mt-4">Create your workspace</h1>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="mt-8 bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
          >
            {step === 1 && (
              <div>
                <h2 className="font-semibold text-slate-800">Confirm your plan</h2>
                <div className="mt-4">
                  <PlanCard
                    id={plan as any}
                    title={pc.title}
                    price={pc.price}
                    limits={pc.limits}
                    highlighted={plan === 'professional'}
                    ctaLabel="Continue with this plan"
                    onSelect={submitPlan}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-4">Or choose another:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.keys(planCards).map(p => (
                    <button key={p} type="button" onClick={() => setPlan(p)} className={`text-xs px-2 py-1 rounded ${plan === p ? 'bg-[#1E3A5F] text-white' : 'bg-slate-100'}`}>{p}</button>
                  ))}
                </div>
                <button type="button" onClick={submitPlan} className="mt-6 w-full bg-[#1E3A5F] text-white py-2.5 rounded-md font-semibold">Continue</button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-slate-800">Account</h2>
                {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={c => c.credential && googleNewAccount(c.credential)}
                      onError={() => toast.error('Google sign-in failed')}
                    />
                  </div>
                )}
                <p className="text-center text-xs text-slate-500">or use email</p>
                <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Company name" value={company_name} onChange={e => setCompanyName(e.target.value)} />
                <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Full name" value={full_name} onChange={e => setFullName(e.target.value)} />
                <input className="w-full border rounded-md px-3 py-2 text-sm" type="email" placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} />
                <input className="w-full border rounded-md px-3 py-2 text-sm" type="password" placeholder="Password (min 8)" value={password} onChange={e => setPassword(e.target.value)} />
                <input className="w-full border rounded-md px-3 py-2 text-sm" type="password" placeholder="Confirm password" value={confirm_password} onChange={e => setConfirmPassword(e.target.value)} />
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={heard_from} onChange={e => setHeardFrom(e.target.value)}>
                  <option value="">Where did you hear about us?</option>
                  {HEARD.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <button type="button" disabled={loading} onClick={requestOtp} className="w-full bg-[#1E3A5F] text-white py-2.5 rounded-md font-semibold disabled:opacity-60">
                  {loading ? 'Sending…' : 'Send verification code'}
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-slate-800">Enter the 6-digit code</h2>
                <p className="text-sm text-slate-600">Sent to {email}</p>
                <input className="w-full border rounded-md px-3 py-2 tracking-widest text-center text-lg" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />
                <button type="button" disabled={loading || otp.length < 6} onClick={verifyOtp} className="w-full bg-[#1E3A5F] text-white py-2.5 rounded-md font-semibold disabled:opacity-60">
                  Verify & continue
                </button>
                <button
                  type="button"
                  disabled={resendSec > 0}
                  onClick={async () => {
                    try {
                      await authApi.signupResend(email)
                      toast.success('Code resent')
                      setResendSec(60)
                    } catch (e: any) { toast.error(e.response?.data?.error || 'Resend failed') }
                  }}
                  className="w-full text-sm text-[#3B82F6] disabled:text-slate-400"
                >
                  Resend {resendSec > 0 ? `(${resendSec}s)` : ''}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-sm text-slate-600 mt-6">
          Already have an account? <Link to="/login" className="text-[#3B82F6] font-medium">Log in</Link>
        </p>
      </div>
    </div>
  )
}
