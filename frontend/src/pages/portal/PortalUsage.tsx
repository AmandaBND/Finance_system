import { useState, useEffect } from 'react'
import { portalApi } from '../../services/api'
import { PLAN_LIMITS, getLimits } from '../../lib/planLimits'
import UsageMeter from '../../components/UsageMeter'
import toast from 'react-hot-toast'

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function PortalUsage() {
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await portalApi.usage()
      setUsage(res.data)
    } catch {
      toast.error('Failed to load usage data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
  )

  if (!usage) return (
    <div className="text-center text-slate-500 py-16">Unable to load usage data right now.</div>
  )

  const plan = usage.plan || 'free'
  const limits = getLimits(plan)
  const planName = capitalize(plan)

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Company usage</p>
          <h1 className="text-2xl font-semibold text-slate-900">Usage overview</h1>
          <p className="text-sm text-slate-500 mt-1">View your current usage and plan limits for company resources.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current plan</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{planName}</p>
          <p className="text-sm text-slate-500 mt-1">{planName === 'Free' ? 'Core company usage with monthly caps.' : `Your ${planName} plan limits.`}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Usage metrics</h2>
          <div className="space-y-4">
            <UsageMeter label="Invoices this month" current={usage.invoicesThisMonth || 0} limit={limits.invoicesPerMonth} />
            <UsageMeter label="Clients" current={usage.totalClients || 0} limit={limits.clients} />
            <UsageMeter label="Expenses this month" current={usage.expensesThisMonth || 0} limit={limits.expensesPerMonth} />
            <UsageMeter label="Active users" current={usage.totalUsers || 0} limit={limits.users} />
            <UsageMeter label="Payroll employees" current={usage.totalEmployees || 0} limit={limits.payrollEmployees} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Plan details</h2>
          <div className="space-y-3 text-sm text-slate-600">
            {Object.entries(PLAN_LIMITS.free).map(([key, value]) => {
              if (typeof value === 'boolean') return null
              const label = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())

              return (
                <div key={key} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                  <span>{label}</span>
                  <span className="font-semibold text-slate-900">{limits[key as keyof typeof limits] === Infinity ? 'Unlimited' : limits[key as keyof typeof limits]}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-5 text-xs text-slate-500">To change the plan, contact your company administrator or use the company admin dashboard.</p>
        </div>
      </div>
    </div>
  )
}
