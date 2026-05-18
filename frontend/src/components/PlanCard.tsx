type PlanId = 'free' | 'professional' | 'business' | 'enterprise'

type Props = {
  id: PlanId
  title: string
  price: string
  subtitle?: string
  limits: string[]
  highlighted?: boolean
  ctaLabel?: string
  onSelect?: () => void
}

export default function PlanCard({
  id,
  title,
  price,
  subtitle,
  limits,
  highlighted,
  ctaLabel = 'Get started',
  onSelect,
}: Props) {
  return (
    <div
      className={`rounded-lg border p-6 flex flex-col h-full bg-white transition-shadow ${
        highlighted ? 'border-[#3B82F6] ring-2 ring-[#3B82F6]/30 shadow-md relative' : 'border-slate-200 shadow-sm'
      }`}
    >
      {highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold bg-[#3B82F6] text-white px-3 py-1 rounded-full">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-bold text-[#1E3A5F]">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 mt-2">{price}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      <ul className="mt-4 space-y-2 text-sm text-slate-600 flex-1">
        {limits.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-emerald-500 shrink-0">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSelect}
        className={`mt-6 w-full py-2.5 rounded-md text-sm font-semibold transition-colors ${
          highlighted
            ? 'bg-[#3B82F6] text-white hover:bg-blue-600'
            : 'bg-[#1E3A5F] text-white hover:bg-[#152a45]'
        }`}
      >
        {ctaLabel}
      </button>
      <span className="sr-only">{id}</span>
    </div>
  )
}
