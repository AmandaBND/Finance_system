import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Revenue from './pages/Revenue'
import Invoices from './pages/Invoices'
import Expenses from './pages/Expenses'
import Salaries from './pages/Salaries'
import RecurringPayments from './pages/RecurringPayments'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Clients from './pages/Clients'
import CompanyLogin from './pages/CompanyLogin'
import Landing from './pages/Landing'
import Signup from './pages/Signup'
import OnboardingPlans from './pages/OnboardingPlans'
import Unauthorized from './pages/Unauthorized'
import PortalLogin from './pages/PortalLogin'
import PortalLayout from './components/PortalLayout/PortalLayout'
import PortalDashboard from './pages/portal/PortalDashboard'
import PortalInvoices from './pages/portal/PortalInvoices'
import PortalPay from './pages/portal/PortalPay'
import PortalHistory from './pages/portal/PortalHistory'
import EmployeeLogin from './pages/EmployeeLogin'
import EmployeeLayout from './components/EmployeeLayout/EmployeeLayout'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import EmployeeSalaries from './pages/employee/EmployeeSalaries'
import EmployeeLeaves from './pages/employee/EmployeeLeaves'
import EmployeeKPI from './pages/employee/EmployeeKPI'
import Projects from './pages/Projects'
import Tasks from './pages/Tasks'
import EmployeeTasks from './pages/employee/EmployeeTasks'
import SuperAdminLogin from './pages/superadmin/SuperAdminLogin'
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard'
import CompanyDetail from './pages/superadmin/CompanyDetail'
import { authApi } from './services/api'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function SessionGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function LegacyAppRedirect({ to, passState }: { to: string; passState?: boolean }) {
  const token = localStorage.getItem('admin_token')
  const state = useLocation().state
  if (!token) return <Navigate to="/login" replace />
  if (passState) return <Navigate to={to} replace state={state} />
  return <Navigate to={to} replace />
}

function PortalGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('portal_token')
  if (!token) return <Navigate to="/portal/login" replace />
  return <>{children}</>
}

function EmployeeGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('employee_token')
  if (!token) return <Navigate to="/employee/login" replace />
  return <>{children}</>
}

function SuperadminGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('superadmin_token')
  if (!token) return <Navigate to="/superadmin/login" replace />
  return <>{children}</>
}

/** Loads /auth/me: blocks client/employee from admin shell; sends first-time companies to onboarding */
function AdminAppGate() {
  const navigate = useNavigate()
  const [state, setState] = useState<'loading' | 'ok' | 'blocked' | 'onboard'>('loading')

  useEffect(() => {
    let cancelled = false
    authApi.me()
      .then(({ data }) => {
        if (cancelled) return
        const role = String(data.role || data.user?.role || 'admin').toLowerCase()
        if (role === 'client' || role === 'employee') {
          setState('blocked')
          return
        }
        const fl = !!(data.first_login || data.company?.first_login)
        if (fl) {
          setState('onboard')
          return
        }
        localStorage.removeItem('admin_first_login')
        setState('ok')
      })
      .catch(() => {
        localStorage.removeItem('admin_token')
        navigate('/login', { replace: true })
      })
    return () => { cancelled = true }
  }, [navigate])

  if (state === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (state === 'blocked') return <Navigate to="/unauthorized" replace />
  if (state === 'onboard') return <Navigate to="/onboarding/plans" replace />
  return <Layout />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3500, style: { borderRadius: '10px', fontSize: '14px' } }} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<CompanyLogin />} />
        <Route path="/onboarding/plans" element={<SessionGuard><OnboardingPlans /></SessionGuard>} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route path="/client-login" element={<Navigate to="/portal/login" replace />} />
        <Route path="/employee-login" element={<Navigate to="/employee/login" replace />} />

        <Route path="/superadmin/login" element={<SuperAdminLogin />} />
        <Route path="/superadmin" element={<SuperadminGuard><SuperAdminDashboard /></SuperadminGuard>} />
        <Route path="/superadmin/companies/:id" element={<SuperadminGuard><CompanyDetail /></SuperadminGuard>} />

        <Route path="/dashboard" element={<LegacyAppRedirect to="/app/dashboard" />} />
        <Route path="/revenue" element={<LegacyAppRedirect to="/app/revenue" />} />
        <Route path="/invoices" element={<LegacyAppRedirect to="/app/invoices" />} />
        <Route path="/expenses" element={<LegacyAppRedirect to="/app/expenses" />} />
        <Route path="/salaries" element={<LegacyAppRedirect to="/app/salaries" />} />
        <Route path="/recurring" element={<LegacyAppRedirect to="/app/recurring" />} />
        <Route path="/clients" element={<LegacyAppRedirect to="/app/clients" />} />
        <Route path="/projects" element={<LegacyAppRedirect to="/app/projects" />} />
        <Route path="/tasks" element={<LegacyAppRedirect to="/app/tasks" />} />
        <Route path="/reports" element={<LegacyAppRedirect to="/app/reports" />} />
        <Route path="/settings" element={<LegacyAppRedirect to="/app/settings" passState />} />

        <Route path="/app" element={<AdminGuard><AdminAppGate /></AdminGuard>}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="salaries" element={<Salaries />} />
          <Route path="recurring" element={<RecurringPayments />} />
          <Route path="clients" element={<Clients />} />
          <Route path="projects" element={<Projects />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal" element={<PortalGuard><PortalLayout /></PortalGuard>}>
          <Route index element={<Navigate to="/portal/dashboard" replace />} />
          <Route path="dashboard" element={<PortalDashboard />} />
          <Route path="invoices" element={<PortalInvoices />} />
          <Route path="pay/:invoiceId" element={<PortalPay />} />
          <Route path="history" element={<PortalHistory />} />
        </Route>

        <Route path="/employee/login" element={<EmployeeLogin />} />
        <Route path="/employee" element={<EmployeeGuard><EmployeeLayout /></EmployeeGuard>}>
          <Route index element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="salaries" element={<EmployeeSalaries />} />
          <Route path="leaves" element={<EmployeeLeaves />} />
          <Route path="kpi" element={<EmployeeKPI />} />
          <Route path="tasks" element={<EmployeeTasks />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
