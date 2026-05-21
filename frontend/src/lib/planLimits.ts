export const PLAN_LIMITS = {
  free: {
    invoicesPerMonth:   10,
    clients:            5,
    users:              1,
    expensesPerMonth:   50,
    receiptOcrPerMonth: 0,
    payrollEmployees:   0,
    clientPortal:       false,
    employeePortal:     false,
    projects:           false,
    multiCurrency:      false,
    apiAccess:          false,
    auditLogDays:       0,
    additionalUsers:    false,
    currencyLimit:      2,
    defaultCurrencies:  ['LKR', 'USD'] as const,
  },
  professional: {
    invoicesPerMonth:   50,
    clients:            25,
    users:              3,
    expensesPerMonth:   500,
    receiptOcrPerMonth: 50,
    payrollEmployees:   5,
    clientPortal:       true,
    employeePortal:     true,
    projects:           false,
    multiCurrency:      true,
    apiAccess:          false,
    auditLogDays:       90,
    additionalUsers:    true,
    currencyLimit:      5,
    defaultCurrencies:  ['LKR', 'USD'] as const,
  },
  business: {
    invoicesPerMonth:   200,
    clients:            100,
    users:              10,
    expensesPerMonth:   2000,
    receiptOcrPerMonth: 500,
    payrollEmployees:   20,
    clientPortal:       true,
    employeePortal:     true,
    projects:           true,
    multiCurrency:      true,
    apiAccess:          true,
    auditLogDays:       365,
    additionalUsers:    true,
    currencyLimit:      10,
    defaultCurrencies:  ['LKR', 'USD'] as const,
  },
  enterprise: {
    invoicesPerMonth:   Infinity,
    clients:            Infinity,
    users:              Infinity,
    expensesPerMonth:   Infinity,
    receiptOcrPerMonth: Infinity,
    payrollEmployees:   Infinity,
    clientPortal:       true,
    employeePortal:     true,
    projects:           true,
    multiCurrency:      true,
    apiAccess:          true,
    auditLogDays:       Infinity,
    additionalUsers:    true,
    currencyLimit:      Infinity,
    defaultCurrencies:  ['LKR', 'USD'] as const,
  },
} as const;

export function getLimits(plan: string) {
  return (PLAN_LIMITS as Record<string, any>)[plan] ?? PLAN_LIMITS.free;
}

export function checkLimit(plan: string, limitKey: keyof typeof PLAN_LIMITS['free'], currentCount: number) {
  const limit = getLimits(plan)[limitKey];
  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
    remaining: limit === Infinity ? Infinity : Math.max(0, limit - currentCount),
  };
}
