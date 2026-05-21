interface Props {
  label: string
  current: number
  limit: number
}

export default function UsageMeter({ label, current, limit }: Props) {
  const percent = limit === Infinity ? 0 : Math.min(100, Math.round((current / limit) * 100))
  let color = 'bg-emerald-500'
  if (percent > 90) color = 'bg-red-500'
  else if (percent > 70) color = 'bg-amber-500'
  const showPulse = limit !== Infinity && current >= limit

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <span>{limit === Infinity ? `${current} / unlimited` : `${current} / ${limit}`}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${limit === Infinity ? 100 : percent}%` }} />
      </div>
      {showPulse && <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium"><span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />At limit</div>}
    </div>
  )
}
