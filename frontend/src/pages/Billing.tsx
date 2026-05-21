import { useMemo } from 'react'
import { usePlanUsage } from '../hooks/usePlanUsage'
import { PLAN_LIMITS, getLimits } from '../lib/planLimits'
import UsageMeter from '../components/UsageMeter'
import { CheckCircle2 } from 'lucide-react'

const PLANS = ['free', 'professional', 'business', 'enterprise'] as const
const PLAN_LABELS: Record<typeof PLANS[number], string> = {
  free: 'Free',
  professional: 'Professional',
  business: 'Business',
  enterprise: 'Enterprise',
}

export default function Billing() {
  const { usage, loading } = usePlanUsage()
  const plan = usage?.plan || 'free'
  const currentLimits = getLimits(plan)
  const planRows = useMemo(() => Object.keys(PLAN_LIMITS.free) as Array<keyof typeof PLAN_LIMITS['free']>, [])

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-slate-500">Billing & plan</p>
          <h1 className="text-2xl font-bold text-slate-900">Current plan</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your limits, see usage, and upgrade anytime.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href="/onboarding/plans" className="btn-secondary">View all plans</a>
          <a href="/onboarding/plans" className="btn-primary">Upgrade plan</a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current Plan</p>
          <p className="mt-3 text-xl font-semibold text-slate-900">{PLAN_LABELS[plan]}</p>
          <p className="mt-1 text-sm text-slate-500">{plan === 'free' ? 'Basic access with core finance features.' : `Your ${PLAN_LABELS[plan]} plan.`}</p>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> {plan === 'free' ? 'Upgrade for extra limits' : 'Preferred support available'}</div>
            {plan !== 'free' && currentLimits.additionalUsers && <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Additional users available on this plan.</div>}
          </div>
        </div>
        <div className="card p-5 lg:col-span-2">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Usage this period</p>
          <div className="mt-4 space-y-4">
            <UsageMeter label="Invoices this month" current={usage?.invoices?.current ?? 0} limit={usage?.invoices?.limit ?? Infinity} />
            <UsageMeter label="Clients" current={usage?.clients?.current ?? 0} limit={usage?.clients?.limit ?? Infinity} />
            <UsageMeter label="Expenses this month" current={usage?.expenses?.current ?? 0} limit={usage?.expenses?.limit ?? Infinity} />
            <UsageMeter label="Team members" current={usage?.users?.current ?? 0} limit={usage?.users?.limit ?? Infinity} />
            <UsageMeter label="Payroll employees" current={usage?.employees?.current ?? 0} limit={usage?.employees?.limit ?? Infinity} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Plan comparison</h2>
            <p className="text-sm text-slate-500">Compare limits across plans and choose what fits your team.</p>
          </div>
          <p className="text-xs text-slate-500">Your current plan is highlighted.</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="p-3">Feature</th>
                {PLANS.map(p => (
                  <th key={p} className="p-3">{PLAN_LABELS[p]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planRows.map(feature => (
                <tr key={feature} className="border-t border-slate-100">
                  <td className="p-3 font-medium text-slate-700 capitalize">{feature}</td>
                  {PLANS.map(p => {
                    const value = getLimits(p)[feature]
                    const cell = typeof value === 'boolean' ? (value ? '✓' : '—') : value === Infinity ? 'Unlimited' : String(value)
                    return (
                      <td key={p} className={`p-3 ${p === plan ? 'bg-slate-100' : ''}`}>{cell}</td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-5 text-sm text-slate-500">
          Downgrading your plan will take effect at the end of your billing period. Data above the new plan&apos;s limits will become read-only.
        </div>
      </div>
    </div>
  )
}
