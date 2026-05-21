import { CURRENCY_SYMBOLS } from '../services/api'

type Props = {
  currency: string
  primaryCurrency: string
  value: string | number
  onChange: (v: string) => void
  /** Label suffix e.g. "total" or "amount" */
  label?: string
}

export function needsPrimaryConversion(currency: string, primaryCurrency: string) {
  return (currency || '').toUpperCase() !== (primaryCurrency || '').toUpperCase()
}

export default function PrimaryCurrencyAmountField({ currency, primaryCurrency, value, onChange, label = 'amount' }: Props) {
  if (!needsPrimaryConversion(currency, primaryCurrency)) return null
  const sym = CURRENCY_SYMBOLS[primaryCurrency] || primaryCurrency
  return (
    <div className="form-full">
      <label className="label">
        {label} in {primaryCurrency} ({sym}) *
      </label>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
        You selected a currency other than your primary ({primaryCurrency}). Enter the manually converted {label} in {primaryCurrency}. This value is used for revenue, reports, and dashboard totals.
      </p>
      <input
        className="input"
        type="number"
        min="0"
        step="0.01"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={`Converted ${label} in ${primaryCurrency}`}
        required
      />
    </div>
  )
}

export function validatePrimaryAmount(currency: string, primaryCurrency: string, amountPrimary: string | number | undefined): string | null {
  if (!needsPrimaryConversion(currency, primaryCurrency)) return null
  const n = parseFloat(String(amountPrimary ?? ''))
  if (!Number.isFinite(n) || n < 0) {
    return `Enter the ${primaryCurrency} equivalent for this transaction`
  }
  return null
}
