import { ChevronRight } from 'lucide-react'

interface Props {
  resourceName: string
  currentPlan: string
  current: number
  limit: number
}

export default function PlanLimitBanner({ resourceName, currentPlan, current, limit }: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">🔒 You've reached your {resourceName} limit</p>
          <p>{resourceName} usage: {current} / {limit === Infinity ? 'unlimited' : limit} on the {currentPlan} plan.</p>
          <p className="text-slate-600">Upgrade to continue adding more {resourceName.toLowerCase()}.</p>
        </div>
        <a href="/app/settings/billing" className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300">
          Upgrade plan <ChevronRight size={14} />
        </a>
      </div>
    </div>
  )
}
