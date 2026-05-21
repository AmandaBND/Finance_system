import { useState, useEffect } from 'react'
import { authApi, companyApi } from '../services/api'
import { checkLimit } from '../lib/planLimits'

interface PlanUsageResult {
  invoices?: ReturnType<typeof checkLimit>
  clients?: ReturnType<typeof checkLimit>
  expenses?: ReturnType<typeof checkLimit>
  users?: ReturnType<typeof checkLimit>
  employees?: ReturnType<typeof checkLimit>
  plan?: string
  companyId?: string
}

export function usePlanUsage() {
  const [usage, setUsage] = useState<PlanUsageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const userRes = await authApi.me()
        const company = userRes.data.company
        const plan = company?.plan || 'free'
        const companyId = company?.id
        if (!companyId) throw new Error('Company ID unavailable')
        const usageRes = await companyApi.usage(companyId)
        const data = usageRes.data
        if (cancelled) return
        setUsage({
          invoices:  checkLimit(plan, 'invoicesPerMonth',   data.invoicesThisMonth),
          clients:   checkLimit(plan, 'clients',            data.totalClients),
          expenses:  checkLimit(plan, 'expensesPerMonth',   data.expensesThisMonth),
          users:     checkLimit(plan, 'users',              data.totalUsers),
          employees: checkLimit(plan, 'payrollEmployees',   data.totalEmployees),
          plan,
          companyId,
        })
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Unable to load plan usage')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { usage, loading, error }
}
