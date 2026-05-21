import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use(config => {
  const t = localStorage.getItem('admin_token')
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

api.interceptors.response.use(
  r => r,
  err => {
    console.error('API Error:', err.response?.data || err.message)
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (body: { username?: string; password?: string; email?: string }) => api.post('/auth/login', body),
  me: () => api.get('/auth/me'),
  changePassword: (data: any) => api.put('/auth/change-password', data),
  signupRequestOtp: (data: {
    company_name: string
    full_name: string
    email: string
    password: string
    confirm_password: string
    plan?: string
    heard_from?: string
  }) => api.post('/auth/signup/request-otp', data),
  signupVerify: (email: string, otp: string) => api.post('/auth/signup/verify', { email, otp }),
  signupResend: (email: string) => api.post('/auth/signup/resend-otp', { email }),
  googleAuth: (credential: string, extra?: { company_name?: string; plan?: string; heard_from?: string }) =>
    api.post('/auth/google', { credential, ...extra }),
}

export const onboardingApi = {
  selectPlan: (plan: string) => api.post('/onboarding/plan', { plan }),
}

const superApi = axios.create({ baseURL: '/api', timeout: 30000 })
superApi.interceptors.request.use(config => {
  const t = localStorage.getItem('superadmin_token')
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

export const superadminApi = {
  login: (email: string, password: string) => axios.post('/api/superadmin/login', { email, password }),
  stats: () => superApi.get('/superadmin/stats'),
  companies: (params?: { q?: string; plan?: string; status?: string }) => superApi.get('/superadmin/companies', { params }),
  company: (id: string) => superApi.get(`/superadmin/companies/${id}`),
  patchCompany: (id: string, data: { plan?: string; status?: string }) => superApi.patch(`/superadmin/companies/${id}`, data),
  activity: () => superApi.get('/superadmin/activity'),
  addNote: (companyId: string, note: string) => superApi.post(`/superadmin/companies/${companyId}/notes`, { note }),
  resetOwnerPassword: (companyId: string, new_password: string) =>
    superApi.post(`/superadmin/companies/${companyId}/reset-owner-password`, { new_password }),
}

export const dashboardApi = {
  get: () => api.get('/dashboard')
}

export const revenueApi = {
  list: (params?: any) => api.get('/revenue', { params }),
  create: (data: any) => api.post('/revenue', data),
  update: (id: number, data: any) => api.put(`/revenue/${id}`, data),
  delete: (id: number) => api.delete(`/revenue/${id}`),
  stats: () => api.get('/revenue/stats')
}

export const invoiceApi = {
  list: (params?: any) => api.get('/invoices', { params }),
  get: (id: number) => api.get(`/invoices/${id}`),
  create: (data: any) => api.post('/invoices', data),
  update: (id: number, data: any) => api.put(`/invoices/${id}`, data),
  delete: (id: number) => api.delete(`/invoices/${id}`),
  send: (id: number) => api.post(`/invoices/${id}/send`),
  markPaid: (id: number, paid_date?: string) => api.post(`/invoices/${id}/mark-paid`, { paid_date }),
  downloadPdf: (id: number) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
}

export const expenseApi = {
  list: (params?: any) => api.get('/expenses', { params }),
  create: (data: FormData) => api.post('/expenses', data),
  update: (id: number, data: FormData) => api.put(`/expenses/${id}`, data),
  delete: (id: number) => api.delete(`/expenses/${id}`),
  categories: () => api.get('/expenses/categories')
}

export const employeeApi = {
  list: () => api.get('/employees'),
  create: (data: any) => api.post('/employees', data),
  update: (id: number, data: any) => api.put(`/employees/${id}`, data),
  delete: (id: number) => api.delete(`/employees/${id}`)
}

export const salaryApi = {
  list: (params?: any) => api.get('/salaries', { params }),
  create: (data: any) => api.post('/salaries', data),
  update: (id: number, data: any) => api.put(`/salaries/${id}`, data),
  delete: (id: number) => api.delete(`/salaries/${id}`),
  pay: (id: number) => api.post(`/salaries/${id}/pay`),
  sendSlip: (id: number, email?: string) => api.post(`/salaries/${id}/send-slip`, { email }),
  downloadPdf: (id: number) => api.get(`/salaries/${id}/pdf`, { responseType: 'blob' }),
  generate: (payment_month: string) => api.post('/salaries/generate', { payment_month })
}

export const recurringApi = {
  list: (params?: any) => api.get('/recurring', { params }),
  create: (data: any) => api.post('/recurring', data),
  update: (id: number, data: any) => api.put(`/recurring/${id}`, data),
  delete: (id: number) => api.delete(`/recurring/${id}`),
  process: (id: number) => api.post(`/recurring/${id}/process`)
}

export const clientApi = {
  list: () => api.get('/clients'),
  create: (data: any) => api.post('/clients', data),
  update: (id: number, data: any) => api.put(`/clients/${id}`, data),
  delete: (id: number) => api.delete(`/clients/${id}`)
}

export const companyApi = {
  usage: (companyId: string) => api.get(`/companies/${companyId}/usage`)
}

export const reportApi = {
  pl: (params?: any) => api.get('/reports/pl', { params }),
  revenue: (params?: any) => api.get('/reports/revenue', { params }),
  expenses: (params?: any) => api.get('/reports/expenses', { params }),
  payroll: (params?: any) => api.get('/reports/payroll', { params }),
  cashflow: (params?: any) => api.get('/reports/cashflow', { params })
}

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
  uploadLogo: (file: File) => {
    const fd = new FormData(); fd.append('logo', file)
    return api.post('/settings/logo', fd)
  },
  testEmail: () => api.post('/settings/test-email')
}

export const notificationApi = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  delete: (id: number) => api.delete(`/notifications/${id}`)
}

export const aiApi = {
  insights: () => api.get('/ai/insights'),
  refresh: () => api.post('/ai/refresh')
}

export const currencyApi = {
  rates: () => api.get('/currency/rates'),
  refresh: () => api.post('/currency/refresh'),
  convert: (amount: number, from: string, to = 'LKR') => api.get('/currency/convert', { params: { amount, from, to } })
}

export const SUPPORTED_CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'INR', 'CAD', 'JPY']

export const CURRENCY_SYMBOLS: Record<string, string> = {
  LKR: 'Rs.', USD: '$', EUR: '€', GBP: '£',
  AUD: 'A$', SGD: 'S$', INR: '₹', CAD: 'C$', JPY: '¥'
}

export function formatCurrency(amount: number, symbol = 'Rs.') {
  return `${symbol} ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

export function formatByCurrency(amount: number, currency = 'LKR') {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  return `${symbol} ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

export function normalizeCurrencyList(value: any): string[] {
  if (Array.isArray(value)) return [...new Set(value.filter((c: any) => typeof c === 'string' && SUPPORTED_CURRENCIES.includes(c)))]
  if (typeof value === 'string') {
    try { return normalizeCurrencyList(JSON.parse(value)) } catch { return [] }
  }
  return []
}

const PLAN_CURRENCY_LIMITS: Record<string, number> = {
  free: 2,
  professional: 5,
  business: 7,
  enterprise: Infinity
}

export function getAllowedCurrencyOptions(plan: string, selected: any): string[] {
  const normalized = normalizeCurrencyList(selected)
  if (plan === 'enterprise') return SUPPORTED_CURRENCIES
  const allowed = ['LKR', 'USD']
  for (const currency of normalized) {
    if (!SUPPORTED_CURRENCIES.includes(currency)) continue
    if (allowed.includes(currency)) continue
    if (allowed.length >= PLAN_CURRENCY_LIMITS[plan]) break
    allowed.push(currency)
  }
  return allowed
}

export function getDefaultCurrency(settings: any) {
  const currency = (settings?.currency || 'USD').toUpperCase()
  return SUPPORTED_CURRENCIES.includes(currency) ? currency : 'USD'
}

// ── Portal API (client-facing, uses Bearer token) ─────────────────────────
function getPortalToken() { return localStorage.getItem('portal_token') || '' }

const portalAxios = axios.create({ baseURL: '/api/portal', timeout: 30000 })
portalAxios.interceptors.request.use(config => {
  config.headers['Authorization'] = `Bearer ${getPortalToken()}`
  return config
})
portalAxios.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('portal_token')
    localStorage.removeItem('portal_client')
    window.location.href = '/portal/login'
  }
  return Promise.reject(err)
})

export const portalAuthApi = {
  login: (username: string, password: string) => axios.post('/api/portal/login', { username, password }),
  me: () => portalAxios.get('/me')
}

export const portalApi = {
  dashboard: () => portalAxios.get('/dashboard'),
  usage: () => portalAxios.get('/usage'),
  invoices: (params?: any) => portalAxios.get('/invoices', { params }),
  invoice: (id: number) => portalAxios.get(`/invoices/${id}`),
  downloadPdf: (id: number) => portalAxios.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  bankDetails: () => portalAxios.get('/bank-details'),
  paymentSlips: () => portalAxios.get('/payment-slips'),
  submitSlip: (data: FormData) => portalAxios.post('/payment-slips', data),
  initiatePayhere: (invoice_id: number) => portalAxios.post('/payment/payhere/initiate', { invoice_id }),
}

// ── Portal Admin API (admin manages portal from within the financial system) ──
export const portalAdminApi = {
  credentials: () => api.get('/portal-admin/credentials'),
  clientsWithoutAccess: () => api.get('/portal-admin/clients-without-access'),
  createCredential: (data: any) => api.post('/portal-admin/credentials', data),
  updateCredential: (id: number, data: any) => api.put(`/portal-admin/credentials/${id}`, data),
  deleteCredential: (id: number) => api.delete(`/portal-admin/credentials/${id}`),
  paymentSlips: (params?: any) => api.get('/portal-admin/payment-slips', { params }),
  reviewSlip: (id: number, data: any) => api.put(`/portal-admin/payment-slips/${id}`, data),
  getGateway: () => api.get('/portal-admin/gateway'),
  updateGateway: (data: any) => api.put('/portal-admin/gateway', data),
  onlinePayments: () => api.get('/portal-admin/online-payments'),
}

// ── Employee Portal API (employee-facing, uses Bearer token) ─────────────────
function getEmployeeToken() { return localStorage.getItem('employee_token') || '' }

const employeeAxios = axios.create({ baseURL: '/api/employee', timeout: 30000 })
employeeAxios.interceptors.request.use(config => {
  config.headers['Authorization'] = `Bearer ${getEmployeeToken()}`
  return config
})
employeeAxios.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('employee_token')
    localStorage.removeItem('employee_info')
    window.location.href = '/employee/login'
  }
  return Promise.reject(err)
})

export const employeeAuthApi = {
  login: (username: string, password: string) => axios.post('/api/employee/login', { username, password }),
  me: () => employeeAxios.get('/me'),
}

export const employeeSelfApi = {
  dashboard: () => employeeAxios.get('/dashboard'),
  salaries: (params?: any) => employeeAxios.get('/salaries', { params }),
  downloadSlip: (id: number) => employeeAxios.get(`/salaries/${id}/pdf`, { responseType: 'blob' }),
  leaves: () => employeeAxios.get('/leaves'),
  requestLeave: (data: any) => employeeAxios.post('/leaves/request', data),
  kpi: (params?: any) => employeeAxios.get('/kpi', { params }),
  birthdayWish: () => employeeAxios.get('/birthday-wish'),
  markWishSeen: () => employeeAxios.post('/birthday-wish/seen'),
}

// ── Employee Admin API (admin manages employee portal) ────────────────────────
export const employeeAdminApi = {
  credentials: () => api.get('/employee-admin/credentials'),
  employeesWithoutAccess: () => api.get('/employee-admin/employees-without-access'),
  createCredential: (data: any) => api.post('/employee-admin/credentials', data),
  updateCredential: (id: number, data: any) => api.put(`/employee-admin/credentials/${id}`, data),
  deleteCredential: (id: number) => api.delete(`/employee-admin/credentials/${id}`),
  leaveRequests: (params?: any) => api.get('/employee-admin/leave-requests', { params }),
  reviewLeave: (id: number, data: any) => api.put(`/employee-admin/leave-requests/${id}`, data),
  getLeaveBalance: (empId: number, year?: number) => api.get(`/employee-admin/leave-balances/${empId}${year ? `?year=${year}` : ''}`),
  updateLeaveBalance: (empId: number, data: any) => api.put(`/employee-admin/leave-balances/${empId}`, data),
  kpiList: (params?: any) => api.get('/employee-admin/kpi', { params }),
  createKpi: (data: any) => api.post('/employee-admin/kpi', data),
  updateKpi: (id: number, data: any) => api.put(`/employee-admin/kpi/${id}`, data),
  deleteKpi: (id: number) => api.delete(`/employee-admin/kpi/${id}`),
  upcomingBirthdays: () => api.get('/employee-admin/upcoming-birthdays'),
  sendBirthdayWish: (employeeId: number, message?: string) => api.post(`/employee-admin/birthday-wish/${employeeId}`, { message }),
}

// ── Project & Task Management API (admin) ─────────────────────────────────
export const projectApi = {
  types:      ()                   => api.get('/projects/types'),
  addType:    (data: any)          => api.post('/projects/types', data),
  deleteType: (id: number)         => api.delete(`/projects/types/${id}`),
  list:       (params?: any)       => api.get('/projects', { params }),
  stats:      ()                   => api.get('/projects/stats'),
  create:     (data: any)          => api.post('/projects', data),
  update:     (id: number, data: any) => api.put(`/projects/${id}`, data),
  delete:     (id: number)         => api.delete(`/projects/${id}`),
}

export const taskAdminApi = {
  list:         (params?: any)       => api.get('/tasks', { params }),
  create:       (data: any)          => api.post('/tasks', data),
  update:       (id: number, data: any) => api.put(`/tasks/${id}`, data),
  delete:       (id: number)         => api.delete(`/tasks/${id}`),
  setStatus:    (id: number, status: string) => api.put(`/tasks/${id}/status`, { status }),
  calendar:     (month: string)      => api.get('/tasks/calendar', { params: { month } }),
  listNotices:  ()                   => api.get('/tasks/notices'),
  createNotice: (data: any)          => api.post('/tasks/notices', data),
  updateNotice: (id: number, data: any) => api.put(`/tasks/notices/${id}`, data),
  deleteNotice: (id: number)         => api.delete(`/tasks/notices/${id}`),
  createEvent:  (data: any)          => api.post('/tasks/calendar/events', data),
  updateEvent:  (id: number, data: any) => api.put(`/tasks/calendar/events/${id}`, data),
  deleteEvent:  (id: number)         => api.delete(`/tasks/calendar/events/${id}`),
}

// ── Employee Task API (employee self-service) ─────────────────────────────
export const employeeTaskApi = {
  list:     (params?: any) => employeeAxios.get('/tasks', { params }),
  notices:  ()             => employeeAxios.get('/tasks/notices'),
  start:    (id: number)   => employeeAxios.post(`/tasks/${id}/start`),
  hold:     (id: number)   => employeeAxios.post(`/tasks/${id}/hold`),
  resume:   (id: number)   => employeeAxios.post(`/tasks/${id}/resume`),
  complete: (id: number)   => employeeAxios.post(`/tasks/${id}/complete`),
}

export default api
