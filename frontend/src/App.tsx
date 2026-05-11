import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import AdminLogin from './pages/AdminLogin'
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

function AdminGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
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

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3500, style: { borderRadius: '10px', fontSize: '14px' } }} />
      <Routes>
        {/* Admin login */}
        <Route path="/login" element={<AdminLogin />} />

        {/* Admin routes */}
        <Route path="/" element={<AdminGuard><Layout /></AdminGuard>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
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

        {/* Client portal - public */}
        <Route path="/portal/login" element={<PortalLogin />} />

        {/* Client portal - protected */}
        <Route path="/portal" element={<PortalGuard><PortalLayout /></PortalGuard>}>
          <Route index element={<Navigate to="/portal/dashboard" replace />} />
          <Route path="dashboard" element={<PortalDashboard />} />
          <Route path="invoices" element={<PortalInvoices />} />
          <Route path="pay/:invoiceId" element={<PortalPay />} />
          <Route path="history" element={<PortalHistory />} />
        </Route>

        {/* Employee portal - public */}
        <Route path="/employee/login" element={<EmployeeLogin />} />

        {/* Employee portal - protected */}
        <Route path="/employee" element={<EmployeeGuard><EmployeeLayout /></EmployeeGuard>}>
          <Route index element={<Navigate to="/employee/dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="salaries" element={<EmployeeSalaries />} />
          <Route path="leaves" element={<EmployeeLeaves />} />
          <Route path="kpi" element={<EmployeeKPI />} />
          <Route path="tasks" element={<EmployeeTasks />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
