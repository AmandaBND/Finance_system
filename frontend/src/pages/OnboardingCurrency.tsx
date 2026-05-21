import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi, onboardingApi, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from '../services/api'

export default function OnboardingCurrency() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [currency, setCurrency] = useState('USD')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await authApi.me()
        if (cancelled) return
        if (data.authType === 'legacy_admin') {
          navigate('/app/dashboard', { replace: true })
          return
        }
        const r = (data.role || '').toLowerCase()
        if (r === 'client' || r === 'employee') {
          navigate('/unauthorized', { replace: true })
          return
        }
        if (data.currency_locked) {
          navigate('/app/dashboard', { replace: true })
          return
        }
        if (data.primary_currency && SUPPORTED_CURRENCIES.includes(data.primary_currency)) {
          setCurrency(data.primary_currency)
        }
      } catch {
        navigate('/login', { replace: true })
        return
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => { cancelled = true }
  }, [navigate])

  async function confirm() {
    setSaving(true)
    try {
      await onboardingApi.setPrimaryCurrency(currency)
      localStorage.removeItem('admin_first_login')
      toast.success('Primary currency saved')
      navigate('/app/dashboard', { replace: true })
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not save currency')
    } finally {
      setSaving(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#1E3A5F]/20 border-t-[#3B82F6] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 font-sans">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center text-[#1E3A5F]">Choose your primary currency</h1>
        <p className="text-center text-slate-600 mt-2 text-sm">
          All reports and dashboard totals use this currency. You can still record invoices and expenses in other allowed currencies.
        </p>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p>
            <strong>Important:</strong> Primary currency cannot be changed after you continue. Choose the currency you use for financial reporting.
          </p>
        </div>

        <div className="card p-6 mt-6 space-y-4">
          <label className="label">Primary currency</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SUPPORTED_CURRENCIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-lg border px-3 py-3 text-sm text-left transition ${
                  currency === c ? 'bg-primary text-white border-primary' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold">{c}</div>
                <div className={`text-xs ${currency === c ? 'text-white/80' : 'text-slate-400'}`}>{CURRENCY_SYMBOLS[c]}</div>
              </button>
            ))}
          </div>
          <button onClick={confirm} disabled={saving} className="btn-primary w-full justify-center mt-4">
            {saving ? 'Saving…' : 'Confirm and finish setup'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
