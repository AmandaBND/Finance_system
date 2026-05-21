const SUPPORTED_CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'INR', 'CAD', 'JPY'];
const DEFAULT_CURRENCIES = ['LKR', 'USD'];

const PLAN_LIMITS = {
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
    defaultCurrencies:  DEFAULT_CURRENCIES,
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
    defaultCurrencies:  DEFAULT_CURRENCIES,
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
    defaultCurrencies:  DEFAULT_CURRENCIES,
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
    defaultCurrencies:  DEFAULT_CURRENCIES,
  },
};

function getLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

function normalizeCurrencyList(value) {
  if (Array.isArray(value)) return [...new Set(value.filter(c => SUPPORTED_CURRENCIES.includes(c)))]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return normalizeCurrencyList(parsed)
    } catch (_) {
      return []
    }
  }
  return []
}

function getAllowedCurrencies(plan, selectedCurrencies) {
  const limits = getLimits(plan)
  const defaults = Array.isArray(limits.defaultCurrencies) ? limits.defaultCurrencies : DEFAULT_CURRENCIES
  if (plan === 'enterprise') {
    return Array.from(new Set([...SUPPORTED_CURRENCIES, ...normalizeCurrencyList(selectedCurrencies)]))
  }
  const allowed = [...defaults]
  const selected = normalizeCurrencyList(selectedCurrencies).filter(c => !allowed.includes(c))
  for (const currency of selected) {
    if (allowed.length >= limits.currencyLimit) break
    allowed.push(currency)
  }
  return allowed
}

function isCurrencyAllowed(plan, currency, selectedCurrencies) {
  if (!currency || typeof currency !== 'string') return false
  if (!SUPPORTED_CURRENCIES.includes(currency)) return false
  if (plan === 'enterprise') return true
  return getAllowedCurrencies(plan, selectedCurrencies).includes(currency)
}

function validateAllowedCurrencies(plan, selectedCurrencies) {
  const allowed = getAllowedCurrencies(plan, selectedCurrencies)
  const normalized = normalizeCurrencyList(selectedCurrencies)
  if (plan === 'free') {
    const invalid = normalized.filter(c => !DEFAULT_CURRENCIES.includes(c))
    if (invalid.length) {
      return { valid: false, error: `Free plan only supports ${DEFAULT_CURRENCIES.join(' and ')}.` }
    }
  }
  if (allowed.length > getLimits(plan).currencyLimit) {
    return { valid: false, error: `Your ${plan} plan allows up to ${getLimits(plan).currencyLimit} currencies including ${DEFAULT_CURRENCIES.join(' and ')}.` }
  }
  return { valid: true, allowed }
}

function checkLimit(plan, limitKey, currentCount) {
  const limit = getLimits(plan)[limitKey]
  return {
    allowed: currentCount < limit,
    limit,
    current: currentCount,
    remaining: limit === Infinity ? Infinity : Math.max(0, limit - currentCount),
  }
}

function planAllows(plan, featureKey) {
  return Boolean(getLimits(plan)[featureKey])
}

module.exports = { PLAN_LIMITS, SUPPORTED_CURRENCIES, getLimits, getAllowedCurrencies, isCurrencyAllowed, validateAllowedCurrencies, normalizeCurrencyList, checkLimit, planAllows };
