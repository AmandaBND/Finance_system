import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { authApi, onboardingApi } from '../services/api'
import PlanCard from '../components/PlanCard'

const plans = [
  { id: 'free' as const, title: 'Free', price: 'LKR 0/mo', limits: ['1 user', '10 invoices/mo', '5 clients', '50 expenses/mo'] },
  { id: 'professional' as const, title: 'Professional', price: 'LKR 4,900/mo', limits: ['3 users', '50 invoices/mo', '25 clients', 'Payroll up to 5'], highlighted: true },
  { id: 'business' as const, title: 'Business', price: 'LKR 12,900/mo', limits: ['10 users', '200 invoices/mo', '100 clients', 'Payroll up to 20'] },
  { id: 'enterprise' as const, title: 'Enterprise', price: 'Custom', limits: ['Unlimited everything', 'Dedicated support'] },
]

export default function OnboardingPlans() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

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
        if (!data.first_login && !data.company?.first_login) {
          navigate('/onboarding/currency', { replace: true })
          return
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

  async function select(plan: string) {
    setSaving(plan)
    try {
      await onboardingApi.selectPlan(plan)
      toast.success('Plan saved')
      navigate('/onboarding/currency', { replace: true })
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Could not save plan')
    } finally {
      setSaving(null)
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
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-center text-[#1E3A5F]">Choose the right plan for your team</h1>
        <p className="text-center text-slate-600 mt-2 text-sm">You can change this later from billing settings.</p>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mt-10">
          {plans.map(p => (
            <PlanCard
              key={p.id}
              id={p.id}
              title={p.title}
              price={p.price}
              limits={p.limits}
              highlighted={p.highlighted}
              ctaLabel={saving === p.id ? 'Saving…' : 'Select plan'}
              onSelect={() => select(p.id)}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
