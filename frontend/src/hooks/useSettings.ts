import { useEffect, useState } from 'react'
import { settingsApi, normalizeCurrencyList, getAllowedCurrencyOptions, getDefaultCurrency, CURRENCY_SYMBOLS } from '../services/api'

export function useCompanySettings() {
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<any>({})

  useEffect(() => {
    let cancelled = false
    settingsApi.get()
      .then(({ data }) => {
        if (cancelled) return
        setSettings(data || {})
      })
      .catch(() => {
        if (!cancelled) setSettings({})
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const plan = (settings?.plan || 'free').toLowerCase()
  const allowedCurrencies = getAllowedCurrencyOptions(plan, settings?.allowed_currencies || [])
  const defaultCurrency = getDefaultCurrency(settings)
  const currencySymbol = CURRENCY_SYMBOLS[defaultCurrency] || settings?.currency_symbol || '$'
  const currencyLocked = !!settings?.currency_locked

  return { loading, settings, allowedCurrencies, defaultCurrency, currencySymbol, currencyLocked }
}
