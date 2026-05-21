import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

interface Props {
  featureName: string
  availableOnPlans: string[]
  currentPlan: string
}

export default function FeatureLockedScreen({ featureName, availableOnPlans, currentPlan }: Props) {
  return (
    <div className="min-h-[calc(100vh-112px)] flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="max-w-xl w-full rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-lg">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-800">
          <Lock size={28} />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{featureName} is not available on your {currentPlan} plan</h1>
        <p className="mt-3 text-sm text-slate-600">This feature is included in {availableOnPlans.join(', ')}.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/app/settings/billing" className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Upgrade plan →
          </Link>
          <Link to="/onboarding/plans" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            View all plans →
          </Link>
        </div>
      </div>
    </div>
  )
}
