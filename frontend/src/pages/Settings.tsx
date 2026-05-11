import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { settingsApi, portalAdminApi, employeeAdminApi, employeeApi, authApi } from '../services/api'
import { Save, Upload, Mail, Building2, Receipt, Bell, Users, CreditCard, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Eye, EyeOff, CheckCircle, XCircle, Clock, ExternalLink, Briefcase, CalendarCheck, BarChart3 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Settings() {
  const [form, setForm] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'company'|'email'|'invoicing'|'automation'|'portal'|'gateway'|'employee'>('company')
  const location = useLocation()

  useEffect(() => {
    const state = location.state as any
    if (state?.tab) setTab(state.tab)
  }, [location.state])

  // Portal credentials state
  const [credentials, setCredentials] = useState<any[]>([])
  const [clientsWithoutAccess, setClientsWithoutAccess] = useState<any[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ client_id: '', username: '', password: '' })
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [creatingCred, setCreatingCred] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [pendingSlips, setPendingSlips] = useState<any[]>([])
  const [reviewingSlip, setReviewingSlip] = useState<number | null>(null)
  const [adminNotes, setAdminNotes] = useState('')

  // Gateway state
  const [gateway, setGateway] = useState<any>({})
  const [savingGateway, setSavingGateway] = useState(false)

  // Admin credentials state
  const [adminPassForm, setAdminPassForm] = useState({ current_password: '', new_password: '', new_username: '', confirm_password: '' })
  const [changingPass, setChangingPass] = useState(false)

  // Employee portal state
  const [empCredentials, setEmpCredentials] = useState<any[]>([])
  const [empWithoutAccess, setEmpWithoutAccess] = useState<any[]>([])
  const [showEmpCreateModal, setShowEmpCreateModal] = useState(false)
  const [empCreateForm, setEmpCreateForm] = useState({ employee_id: '', username: '', password: '' })
  const [empCreatedPassword, setEmpCreatedPassword] = useState<string | null>(null)
  const [empCreatingCred, setEmpCreatingCred] = useState(false)
  const [empShowPass, setEmpShowPass] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [reviewingLeave, setReviewingLeave] = useState<number | null>(null)
  const [leaveNotes, setLeaveNotes] = useState('')
  const [kpiEmployees, setKpiEmployees] = useState<any[]>([])
  const [kpiList, setKpiList] = useState<any[]>([])
  const [kpiForm, setKpiForm] = useState<any>({ employee_id: '', month: new Date().toISOString().slice(0,7), performance_score: 80, kpi_target: 80, tasks_completed: 0, attendance_pct: 100, notes: '' })
  const [savingKpi, setSavingKpi] = useState(false)
  const [editingKpiId, setEditingKpiId] = useState<number | null>(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (tab === 'portal') loadPortal()
    if (tab === 'gateway') loadGateway()
    if (tab === 'employee') loadEmployee()
  }, [tab])

  async function load() {
    try {
      const r = await settingsApi.get()
      setForm(r.data || {})
      if (r.data?.logo_path) setLogoPreview(r.data.logo_path)
    } catch {} finally { setLoading(false) }
  }

  async function loadPortal() {
    try {
      const [credRes, clientRes, slipRes] = await Promise.all([
        portalAdminApi.credentials(),
        portalAdminApi.clientsWithoutAccess(),
        portalAdminApi.paymentSlips({ status: 'Pending' })
      ])
      setCredentials(credRes.data)
      setClientsWithoutAccess(clientRes.data)
      setPendingSlips(slipRes.data)
    } catch { toast.error('Failed to load portal data') }
  }

  async function loadGateway() {
    try {
      const r = await portalAdminApi.getGateway()
      setGateway(r.data || {})
    } catch { toast.error('Failed to load gateway settings') }
  }

  async function loadEmployee() {
    try {
      const [credRes, empRes, leaveRes, allEmpRes, kpiRes] = await Promise.all([
        employeeAdminApi.credentials(),
        employeeAdminApi.employeesWithoutAccess(),
        employeeAdminApi.leaveRequests({ status: 'Pending' }),
        employeeApi.list(),
        employeeAdminApi.kpiList()
      ])
      setEmpCredentials(credRes.data)
      setEmpWithoutAccess(empRes.data)
      setLeaveRequests(leaveRes.data)
      setKpiEmployees(allEmpRes.data)
      setKpiList(kpiRes.data)
    } catch { toast.error('Failed to load employee portal data') }
  }

  async function save() {
    try {
      setSaving(true)
      await settingsApi.update(form)
      toast.success('Settings saved!')
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  async function saveGateway() {
    try {
      setSavingGateway(true)
      const gw = { ...gateway }
      if (typeof gw.enabled_gateways === 'object') {
        gw.enabled_gateways = JSON.stringify(gw.enabled_gateways)
      }
      await portalAdminApi.updateGateway(gw)
      toast.success('Gateway settings saved!')
      loadGateway()
    } catch { toast.error('Failed to save gateway') } finally { setSavingGateway(false) }
  }

  async function uploadLogo(file: File) {
    try {
      const res = await settingsApi.uploadLogo(file)
      setLogoPreview(res.data.logo_path)
      setForm((f: any) => ({ ...f, logo_path: res.data.logo_path }))
      toast.success('Logo uploaded!')
    } catch { toast.error('Upload failed') }
  }

  async function testEmail() {
    try {
      setTestingEmail(true)
      await settingsApi.testEmail()
      toast.success('Test email sent! Check your inbox.')
    } catch (err: any) { toast.error(err.response?.data?.error || 'Email test failed') } finally { setTestingEmail(false) }
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  async function createCredential() {
    if (!createForm.client_id || !createForm.username || !createForm.password) {
      toast.error('Fill all fields'); return
    }
    setCreatingCred(true)
    try {
      await portalAdminApi.createCredential(createForm)
      setCreatedPassword(createForm.password)
      setShowCreateModal(false)
      setCreateForm({ client_id: '', username: '', password: '' })
      loadPortal()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create credential')
    } finally { setCreatingCred(false) }
  }

  async function toggleActive(id: number, current: number) {
    try {
      await portalAdminApi.updateCredential(id, { is_active: current ? 0 : 1 })
      toast.success(current ? 'Access disabled' : 'Access enabled')
      loadPortal()
    } catch { toast.error('Failed to update') }
  }

  async function resetPassword(id: number) {
    const newPass = generatePassword()
    try {
      await portalAdminApi.updateCredential(id, { password: newPass })
      setCreatedPassword(newPass)
      toast.success('Password reset!')
    } catch { toast.error('Failed to reset password') }
  }

  async function deleteCred(id: number) {
    if (!confirm('Remove portal access for this client?')) return
    try {
      await portalAdminApi.deleteCredential(id)
      toast.success('Access removed')
      loadPortal()
    } catch { toast.error('Failed to delete') }
  }

  // ── Employee portal handlers ──────────────────────────────────────────────
  async function createEmpCredential() {
    if (!empCreateForm.employee_id || !empCreateForm.username || !empCreateForm.password) {
      toast.error('Fill all fields'); return
    }
    setEmpCreatingCred(true)
    try {
      await employeeAdminApi.createCredential(empCreateForm)
      setEmpCreatedPassword(empCreateForm.password)
      setShowEmpCreateModal(false)
      setEmpCreateForm({ employee_id: '', username: '', password: '' })
      loadEmployee()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create credential')
    } finally { setEmpCreatingCred(false) }
  }

  async function toggleEmpActive(id: number, current: number) {
    try {
      await employeeAdminApi.updateCredential(id, { is_active: current ? 0 : 1 })
      toast.success(current ? 'Access disabled' : 'Access enabled')
      loadEmployee()
    } catch { toast.error('Failed to update') }
  }

  async function resetEmpPassword(id: number) {
    const newPass = generatePassword()
    try {
      await employeeAdminApi.updateCredential(id, { password: newPass })
      setEmpCreatedPassword(newPass)
      toast.success('Password reset!')
    } catch { toast.error('Failed to reset password') }
  }

  async function deleteEmpCred(id: number) {
    if (!confirm('Remove portal access for this employee?')) return
    try {
      await employeeAdminApi.deleteCredential(id)
      toast.success('Access removed')
      loadEmployee()
    } catch { toast.error('Failed to delete') }
  }

  async function reviewLeave(id: number, action: 'Approved' | 'Rejected') {
    setReviewingLeave(id)
    try {
      await employeeAdminApi.reviewLeave(id, { status: action, admin_notes: leaveNotes })
      toast.success(`Leave request ${action.toLowerCase()}!`)
      setLeaveNotes('')
      loadEmployee()
    } catch { toast.error('Failed to review leave') } finally { setReviewingLeave(null) }
  }

  async function saveKpi() {
    if (!kpiForm.employee_id || !kpiForm.month) { toast.error('Select employee and month'); return }
    setSavingKpi(true)
    try {
      if (editingKpiId) {
        await employeeAdminApi.updateKpi(editingKpiId, kpiForm)
        toast.success('KPI updated!')
        setEditingKpiId(null)
      } else {
        await employeeAdminApi.createKpi(kpiForm)
        toast.success('KPI saved!')
      }
      setKpiForm({ employee_id: '', month: new Date().toISOString().slice(0,7), performance_score: 80, kpi_target: 80, tasks_completed: 0, attendance_pct: 100, notes: '' })
      loadEmployee()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to save KPI') } finally { setSavingKpi(false) }
  }

  async function deleteKpi(id: number) {
    if (!confirm('Delete this KPI record?')) return
    try {
      await employeeAdminApi.deleteKpi(id)
      toast.success('KPI deleted')
      loadEmployee()
    } catch { toast.error('Failed to delete KPI') }
  }

  async function changeAdminPassword() {
    if (!adminPassForm.current_password || !adminPassForm.new_password) { toast.error('Fill required fields'); return }
    if (adminPassForm.new_password !== adminPassForm.confirm_password) { toast.error('Passwords do not match'); return }
    if (adminPassForm.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setChangingPass(true)
    try {
      await authApi.changePassword({ current_password: adminPassForm.current_password, new_password: adminPassForm.new_password, new_username: adminPassForm.new_username })
      toast.success('Admin credentials updated!')
      setAdminPassForm({ current_password: '', new_password: '', new_username: '', confirm_password: '' })
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to update') } finally { setChangingPass(false) }
  }

  async function reviewSlip(id: number, action: 'Approved' | 'Rejected') {
    setReviewingSlip(id)
    try {
      await portalAdminApi.reviewSlip(id, { status: action, admin_notes: adminNotes })
      toast.success(`Slip ${action.toLowerCase()}!`)
      setAdminNotes('')
      loadPortal()
    } catch { toast.error('Failed to review slip') } finally { setReviewingSlip(null) }
  }

  const f = (key: string) => form[key] || ''
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }))

  const gw = (key: string) => gateway[key] ?? ''
  const setGw = (key: string, val: any) => setGateway((p: any) => ({ ...p, [key]: val }))

  const enabledGateways: string[] = (() => {
    try {
      if (Array.isArray(gateway.enabled_gateways)) return gateway.enabled_gateways
      return JSON.parse(gateway.enabled_gateways || '["bank_transfer"]')
    } catch { return ['bank_transfer'] }
  })()

  function toggleGateway(gname: string) {
    const current = enabledGateways
    const updated = current.includes(gname) ? current.filter(g => g !== gname) : [...current, gname]
    setGw('enabled_gateways', updated)
  }

  const tabs = [
    { id: 'company', label: 'Company', icon: Building2 },
    { id: 'email', label: 'Email / SMTP', icon: Mail },
    { id: 'invoicing', label: 'Invoicing', icon: Receipt },
    { id: 'automation', label: 'Automation', icon: Bell },
    { id: 'portal', label: 'Client Portal', icon: Users },
    { id: 'gateway', label: 'Payment Gateway', icon: CreditCard },
    { id: 'employee', label: 'Employee Portal', icon: Briefcase },
  ]

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="space-y-5 fade-in max-w-4xl">
      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Company Tab */}
      {tab === 'company' && (
        <div className="space-y-6">
        <div className="card p-6 space-y-5">
          <h3 className="section-title">Company Details</h3>
          <div>
            <label className="label">Company Logo</label>
            <div className="flex items-center gap-4">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-20 h-20 object-contain rounded-lg border border-slate-200 p-2 bg-white" />
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                  <Building2 size={28} />
                </div>
              )}
              <div>
                <button onClick={() => logoRef.current?.click()} className="btn-secondary"><Upload size={14} /> Upload Logo</button>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5MB. Used on invoices & salary slips.</p>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              </div>
            </div>
          </div>
          <div className="form-grid">
            <div><label className="label">Company Name</label><input className="input" value={f('company_name')} onChange={e => set('company_name', e.target.value)} /></div>
            <div><label className="label">Company Email</label><input className="input" type="email" value={f('company_email')} onChange={e => set('company_email', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={f('company_phone')} onChange={e => set('company_phone', e.target.value)} /></div>
            <div><label className="label">Website</label><input className="input" value={f('company_website')} onChange={e => set('company_website', e.target.value)} /></div>
            <div className="form-full"><label className="label">Address</label><textarea className="input h-20 resize-none" value={f('company_address')} onChange={e => set('company_address', e.target.value)} /></div>
            <div><label className="label">Currency</label>
              <select className="input" value={f('currency')} onChange={e => set('currency', e.target.value)}>
                {['LKR','USD','EUR','GBP','AUD','SGD'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Currency Symbol</label><input className="input" value={f('currency_symbol')} onChange={e => set('currency_symbol', e.target.value)} placeholder="Rs." /></div>
          </div>
        </div>

        {/* Admin Credentials */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="section-title">Admin Login Credentials</h3>
            <p className="text-xs text-slate-400 mt-0.5">Change the username and password used to log in to this dashboard</p>
          </div>
          <div className="form-grid">
            <div><label className="label">Current Password *</label><input className="input" type="password" value={adminPassForm.current_password} onChange={e => setAdminPassForm(f => ({...f, current_password: e.target.value}))} placeholder="Enter current password" /></div>
            <div><label className="label">New Username (optional)</label><input className="input" value={adminPassForm.new_username} onChange={e => setAdminPassForm(f => ({...f, new_username: e.target.value}))} placeholder="Leave blank to keep current" /></div>
            <div><label className="label">New Password *</label><input className="input" type="password" value={adminPassForm.new_password} onChange={e => setAdminPassForm(f => ({...f, new_password: e.target.value}))} placeholder="Min 6 characters" /></div>
            <div><label className="label">Confirm New Password *</label><input className="input" type="password" value={adminPassForm.confirm_password} onChange={e => setAdminPassForm(f => ({...f, confirm_password: e.target.value}))} placeholder="Repeat new password" /></div>
          </div>
          <div className="flex justify-end">
            <button onClick={changeAdminPassword} disabled={changingPass} className="btn-primary px-5">
              <Save size={14} />{changingPass ? 'Updating...' : 'Update Credentials'}
            </button>
          </div>
        </div>
        </div>
      )}

      {/* Email Tab */}
      {tab === 'email' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="section-title">Email Configuration</h3>
            <button onClick={testEmail} disabled={testingEmail} className="btn-secondary text-xs"><Mail size={13} />{testingEmail ? 'Sending...' : 'Send Test Email'}</button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <strong>Current:</strong> {f('smtp_user')} via {f('smtp_host')}:{f('smtp_port')}
          </div>
          <div className="form-grid">
            <div><label className="label">SMTP Host</label><input className="input" value={f('smtp_host')} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.hostinger.com" /></div>
            <div><label className="label">SMTP Port</label><input className="input" type="number" value={f('smtp_port')} onChange={e => set('smtp_port', e.target.value)} /></div>
            <div><label className="label">Email Address</label><input className="input" type="email" value={f('smtp_user')} onChange={e => set('smtp_user', e.target.value)} /></div>
            <div><label className="label">Email Password</label><input className="input" type="password" value={f('smtp_pass')} onChange={e => set('smtp_pass', e.target.value)} placeholder="••••••••" /></div>
            <div><label className="label">Use SSL/TLS</label>
              <select className="input" value={f('smtp_secure')} onChange={e => set('smtp_secure', e.target.value === '1' ? 1 : 0)}>
                <option value="1">SSL (Port 465)</option>
                <option value="0">TLS/STARTTLS (Port 587)</option>
              </select>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">OpenAI API Key</h4>
            <input className="input font-mono text-xs" value={f('openai_key')} onChange={e => set('openai_key', e.target.value)} placeholder="sk-proj-..." />
            <p className="text-xs text-slate-400 mt-1">Required for AI insights, predictions and recommendations on the dashboard.</p>
          </div>
        </div>
      )}

      {/* Invoicing Tab */}
      {tab === 'invoicing' && (
        <div className="card p-6 space-y-5">
          <h3 className="section-title">Invoice & Document Settings</h3>
          <div className="form-grid">
            <div><label className="label">Invoice Prefix</label><input className="input" value={f('invoice_prefix')} onChange={e => set('invoice_prefix', e.target.value)} placeholder="INV" /></div>
            <div><label className="label">Salary Slip Prefix</label><input className="input" value={f('salary_prefix')} onChange={e => set('salary_prefix', e.target.value)} placeholder="SAL" /></div>
            <div className="form-full"><label className="label">Default Invoice Terms</label><textarea className="input h-20 resize-none" value={f('invoice_terms')} onChange={e => set('invoice_terms', e.target.value)} placeholder="Payment is due within 30 days of invoice date." /></div>
            <div className="form-full"><label className="label">Default Invoice Notes</label><textarea className="input h-20 resize-none" value={f('invoice_notes')} onChange={e => set('invoice_notes', e.target.value)} placeholder="Thank you for your business!" /></div>
          </div>
        </div>
      )}

      {/* Automation Tab */}
      {tab === 'automation' && (
        <div className="card p-6 space-y-5">
          <h3 className="section-title">Automated Actions</h3>
          <div className="space-y-4">
            {[
              { key: 'auto_send_invoices', label: 'Auto-Send Invoice Emails', desc: 'Automatically email invoices when status is set to "Sent"' },
              { key: 'auto_send_reminders', label: 'Auto-Send Payment Reminders', desc: 'Send reminders for upcoming and overdue invoices daily at 9 AM' },
              { key: 'overdue_check_enabled', label: 'Overdue Invoice Detection', desc: 'Automatically mark invoices as "Overdue" after due date (runs hourly)' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={!!f(key)} onChange={e => set(key, e.target.checked ? 1 : 0)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            ))}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-2">Reminder Days Before Due</p>
              <p className="text-xs text-slate-400 mb-3">Send payment reminder this many days before the invoice due date</p>
              <input type="number" min="1" max="30" className="input w-24" value={f('reminder_days_before') || 3} onChange={e => set('reminder_days_before', parseInt(e.target.value))} />
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-emerald-700">🤖 Automated Schedule</p>
            <ul className="text-xs text-emerald-600 mt-2 space-y-1">
              <li>• <strong>Every hour:</strong> Overdue invoice detection</li>
              <li>• <strong>9 AM daily:</strong> Payment reminders (invoices + recurring)</li>
              <li>• <strong>Midnight daily:</strong> Low cash balance alert</li>
              <li>• <strong>Sunday 10 AM:</strong> AI insights refresh</li>
            </ul>
          </div>
        </div>
      )}

      {/* Client Portal Tab */}
      {tab === 'portal' && (
        <div className="space-y-5">
          {/* Created password notification */}
          {createdPassword && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-emerald-700 mb-1">Portal credentials created!</p>
              <p className="text-xs text-emerald-600 mb-2">Share this password with the client — it will not be shown again.</p>
              <div className="flex items-center gap-3 bg-white border border-emerald-200 rounded-lg p-3">
                <code className="flex-1 text-sm font-mono font-bold text-slate-800 tracking-wider">{createdPassword}</code>
                <button onClick={() => { navigator.clipboard.writeText(createdPassword); toast.success('Copied!') }} className="text-xs px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded font-medium">Copy</button>
                <button onClick={() => setCreatedPassword(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={16} /></button>
              </div>
            </div>
          )}

          {/* Credentials */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">Client Portal Access</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage login credentials for client portal at <span className="font-mono text-indigo-600">/portal/login</span></p>
              </div>
              <button onClick={() => { setShowCreateModal(true); setCreateForm({ client_id: '', username: '', password: generatePassword() }) }} className="btn-primary text-sm">
                <Plus size={14} /> Create Access
              </button>
            </div>

            {credentials.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                No clients have portal access yet. Click "Create Access" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Client</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Username</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Last Login</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Status</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map(cred => (
                      <tr key={cred.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-sm text-slate-700 font-medium">{cred.client_name || cred.username}</td>
                        <td className="px-3 py-3 text-sm font-mono text-slate-500">{cred.username}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">{cred.last_login ? new Date(cred.last_login).toLocaleDateString('en-LK') : 'Never'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cred.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {cred.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => toggleActive(cred.id, cred.is_active)} title={cred.is_active ? 'Disable' : 'Enable'} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700">
                              {cred.is_active ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                            </button>
                            <button onClick={() => resetPassword(cred.id)} title="Reset Password" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-amber-500">
                              <RefreshCw size={14} />
                            </button>
                            <button onClick={() => deleteCred(cred.id)} title="Remove Access" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Payment Slips */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">Pending Payment Slips</h3>
                <p className="text-xs text-slate-400 mt-0.5">Review bank transfer slips submitted by clients</p>
              </div>
              {pendingSlips.length > 0 && (
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                  {pendingSlips.length} pending
                </span>
              )}
            </div>

            {pendingSlips.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                No pending payment slips
              </div>
            ) : (
              <div className="space-y-3">
                {pendingSlips.map(slip => (
                  <div key={slip.id} className="border border-slate-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{slip.client_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Invoice #{slip.invoice_number} · {new Date(slip.submitted_at).toLocaleDateString('en-LK')}</p>
                        {slip.reference && <p className="text-xs text-slate-400 mt-0.5">Ref: {slip.reference}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">Rs. {Number(slip.amount || 0).toLocaleString()}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1">
                          <Clock size={10} /> Pending
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <a href={`http://localhost:3001/${slip.slip_path}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        <ExternalLink size={12} /> View Slip
                      </a>
                      <input
                        type="text"
                        placeholder="Admin notes (optional)"
                        value={reviewingSlip === slip.id ? adminNotes : ''}
                        onFocus={() => setReviewingSlip(slip.id)}
                        onChange={e => setAdminNotes(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button onClick={() => reviewSlip(slip.id, 'Approved')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button onClick={() => reviewSlip(slip.id, 'Rejected')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors">
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Portal Tab */}
      {tab === 'employee' && (
        <div className="space-y-5">
          {/* Created password notification */}
          {empCreatedPassword && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-emerald-700 mb-1">Employee portal credentials created!</p>
              <p className="text-xs text-emerald-600 mb-2">Share this password with the employee — it will not be shown again.</p>
              <div className="flex items-center gap-3 bg-white border border-emerald-200 rounded-lg p-3">
                <code className="flex-1 text-sm font-mono font-bold text-slate-800 tracking-wider">{empCreatedPassword}</code>
                <button onClick={() => { navigator.clipboard.writeText(empCreatedPassword); toast.success('Copied!') }} className="text-xs px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded font-medium">Copy</button>
                <button onClick={() => setEmpCreatedPassword(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={16} /></button>
              </div>
            </div>
          )}

          {/* Employee Portal Access */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title">Employee Portal Access</h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage login credentials for the employee portal at <span className="font-mono text-emerald-600">/employee/login</span></p>
              </div>
              <button
                onClick={() => { setShowEmpCreateModal(true); setEmpCreateForm({ employee_id: '', username: '', password: generatePassword() }) }}
                className="btn-primary text-sm"
              >
                <Plus size={14} /> Create Access
              </button>
            </div>

            {empCredentials.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                No employees have portal access yet. Click "Create Access" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Employee</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Username</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Last Login</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Status</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empCredentials.map((cred: any) => (
                      <tr key={cred.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-sm text-slate-700 font-medium">{cred.employee_name || cred.username}</td>
                        <td className="px-3 py-3 text-sm font-mono text-slate-500">{cred.username}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">{cred.last_login ? new Date(cred.last_login).toLocaleDateString('en-LK') : 'Never'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cred.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {cred.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => toggleEmpActive(cred.id, cred.is_active)} title={cred.is_active ? 'Disable' : 'Enable'} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700">
                              {cred.is_active ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                            </button>
                            <button onClick={() => resetEmpPassword(cred.id)} title="Reset Password" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-amber-500">
                              <RefreshCw size={14} />
                            </button>
                            <button onClick={() => deleteEmpCred(cred.id)} title="Remove Access" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Leave Requests */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-title flex items-center gap-2"><CalendarCheck size={16} className="text-emerald-600" /> Pending Leave Requests</h3>
                <p className="text-xs text-slate-400 mt-0.5">Review and approve/reject employee leave requests</p>
              </div>
              {leaveRequests.length > 0 && (
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                  {leaveRequests.length} pending
                </span>
              )}
            </div>

            {leaveRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                No pending leave requests
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((lr: any) => (
                  <div key={lr.id} className="border border-slate-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{lr.employee_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${lr.leave_type === 'Annual' ? 'bg-blue-100 text-blue-700' : lr.leave_type === 'Sick' ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>
                            {lr.leave_type}
                          </span>
                          {lr.start_date} → {lr.end_date} · {lr.days_count} day{lr.days_count !== 1 ? 's' : ''}
                        </p>
                        {lr.reason && <p className="text-xs text-slate-400 mt-1 italic">"{lr.reason}"</p>}
                        <p className="text-xs text-slate-300 mt-0.5">Requested {new Date(lr.requested_at).toLocaleDateString('en-LK')}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        <Clock size={10} /> Pending
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Admin notes (optional)"
                        value={reviewingLeave === lr.id ? leaveNotes : ''}
                        onFocus={() => setReviewingLeave(lr.id)}
                        onChange={e => setLeaveNotes(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                      <button onClick={() => reviewLeave(lr.id, 'Approved')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button onClick={() => reviewLeave(lr.id, 'Rejected')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors">
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KPI Entry */}
          <div className="card p-6 space-y-4">
            <div>
              <h3 className="section-title flex items-center gap-2"><BarChart3 size={16} className="text-emerald-600" /> KPI Entry</h3>
              <p className="text-xs text-slate-400 mt-0.5">Enter monthly KPI scores for employees</p>
            </div>

            {/* KPI Form */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{editingKpiId ? 'Edit KPI Record' : 'Add New KPI Record'}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Employee</label>
                  <select className="input" value={kpiForm.employee_id} onChange={e => setKpiForm((f: any) => ({ ...f, employee_id: e.target.value }))}>
                    <option value="">— Select employee —</option>
                    {kpiEmployees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.employee_name} {e.department ? `(${e.department})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Month</label>
                  <input type="month" className="input" value={kpiForm.month} onChange={e => setKpiForm((f: any) => ({ ...f, month: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Performance Score (0–100)</label>
                  <input type="number" min="0" max="100" className="input" value={kpiForm.performance_score} onChange={e => setKpiForm((f: any) => ({ ...f, performance_score: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">KPI Target (0–100)</label>
                  <input type="number" min="0" max="100" className="input" value={kpiForm.kpi_target} onChange={e => setKpiForm((f: any) => ({ ...f, kpi_target: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Tasks Completed</label>
                  <input type="number" min="0" className="input" value={kpiForm.tasks_completed} onChange={e => setKpiForm((f: any) => ({ ...f, tasks_completed: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="label">Attendance %</label>
                  <input type="number" min="0" max="100" className="input" value={kpiForm.attendance_pct} onChange={e => setKpiForm((f: any) => ({ ...f, attendance_pct: Number(e.target.value) }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Notes (optional)</label>
                  <input type="text" className="input" value={kpiForm.notes} onChange={e => setKpiForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Exceeded targets in Q1 project delivery" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                {editingKpiId && (
                  <button onClick={() => { setEditingKpiId(null); setKpiForm({ employee_id: '', month: new Date().toISOString().slice(0,7), performance_score: 80, kpi_target: 80, tasks_completed: 0, attendance_pct: 100, notes: '' }) }} className="btn-secondary text-sm">Cancel</button>
                )}
                <button onClick={saveKpi} disabled={savingKpi} className="btn-primary text-sm">
                  <Save size={13} />{savingKpi ? 'Saving...' : editingKpiId ? 'Update KPI' : 'Save KPI'}
                </button>
              </div>
            </div>

            {/* KPI List */}
            {kpiList.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Employee</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-left">Month</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Score</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Target</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Tasks</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Attendance</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiList.map((k: any) => (
                      <tr key={k.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3 py-3 text-sm text-slate-700 font-medium">{k.employee_name}</td>
                        <td className="px-3 py-3 text-sm text-slate-500">{k.month}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${k.performance_score >= 80 ? 'bg-emerald-100 text-emerald-700' : k.performance_score >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                            {k.performance_score}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center text-sm text-slate-500">{k.kpi_target}</td>
                        <td className="px-3 py-3 text-center text-sm text-slate-500">{k.tasks_completed}</td>
                        <td className="px-3 py-3 text-center text-sm text-slate-500">{k.attendance_pct}%</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setEditingKpiId(k.id); setKpiForm({ employee_id: String(k.employee_id), month: k.month, performance_score: k.performance_score, kpi_target: k.kpi_target, tasks_completed: k.tasks_completed, attendance_pct: k.attendance_pct, notes: k.notes || '' }) }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
                              title="Edit"
                            >
                              <RefreshCw size={13} />
                            </button>
                            <button onClick={() => deleteKpi(k.id)} title="Delete" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-red-500">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Gateway Tab */}
      {tab === 'gateway' && (
        <div className="space-y-5">
          {/* Enabled gateways */}
          <div className="card p-6 space-y-4">
            <h3 className="section-title">Payment Methods</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'bank_transfer', label: 'Bank Transfer', desc: 'Clients upload payment slips for manual verification' },
                { id: 'payhere', label: 'PayHere', desc: 'Online payments via credit/debit card & online banking' },
              ].map(gname => (
                <div
                  key={gname.id}
                  onClick={() => toggleGateway(gname.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${enabledGateways.includes(gname.id) ? 'border-indigo-400 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-slate-700">{gname.label}</p>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${enabledGateways.includes(gname.id) ? 'border-indigo-500 bg-indigo-500' : 'border-slate-200'}`}>
                      {enabledGateways.includes(gname.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{gname.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bank Details */}
          <div className="card p-6 space-y-4">
            <h3 className="section-title">Bank Transfer Details</h3>
            <p className="text-xs text-slate-400">These details are displayed to clients in the payment portal.</p>
            <div className="form-grid">
              <div><label className="label">Bank Name</label><input className="input" value={gw('bank_name')} onChange={e => setGw('bank_name', e.target.value)} placeholder="DFCC Bank Gampaha" /></div>
              <div><label className="label">Branch</label><input className="input" value={gw('bank_branch')} onChange={e => setGw('bank_branch', e.target.value)} placeholder="Gampaha" /></div>
              <div><label className="label">Account Name</label><input className="input" value={gw('bank_account_name')} onChange={e => setGw('bank_account_name', e.target.value)} placeholder="Groovymark (pvt) Ltd" /></div>
              <div><label className="label">Account Number</label><input className="input font-mono" value={gw('bank_account_no')} onChange={e => setGw('bank_account_no', e.target.value)} placeholder="102005870825" /></div>
              <div><label className="label">SWIFT Code</label><input className="input font-mono" value={gw('bank_swift')} onChange={e => setGw('bank_swift', e.target.value)} placeholder="DFCCLKLX" /></div>
            </div>
          </div>

          {/* PayHere Config */}
          {enabledGateways.includes('payhere') && (
            <div className="card p-6 space-y-4">
              <h3 className="section-title">PayHere Configuration</h3>
              <div className="form-grid">
                <div><label className="label">Merchant ID</label><input className="input font-mono" value={gw('payhere_merchant_id')} onChange={e => setGw('payhere_merchant_id', e.target.value)} placeholder="1234567" /></div>
                <div><label className="label">Merchant Secret</label><input className="input font-mono" type="password" value={gw('payhere_secret')} onChange={e => setGw('payhere_secret', e.target.value)} placeholder="••••••••••••" /></div>
                <div>
                  <label className="label">Mode</label>
                  <select className="input" value={gw('payhere_mode')} onChange={e => setGw('payhere_mode', e.target.value)}>
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>
              </div>
              <div className={`p-3 rounded-lg text-xs ${gw('payhere_mode') === 'live' ? 'bg-amber-50 border border-amber-200 text-amber-700' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                {gw('payhere_mode') === 'live' ? '⚠️ Live mode — real payments will be processed.' : 'ℹ️ Sandbox mode — use PayHere test credentials. No real payments.'}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={saveGateway} disabled={savingGateway} className="btn-primary px-6">
              <Save size={16} />{savingGateway ? 'Saving...' : 'Save Gateway Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Save button for non-gateway/portal/employee tabs */}
      {tab !== 'portal' && tab !== 'gateway' && tab !== 'employee' && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving} className="btn-primary px-6">
            <Save size={16} />{saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Employee Create Access Modal */}
      {showEmpCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><Briefcase size={16} className="text-emerald-600" /> Create Employee Portal Access</h3>
            <div>
              <label className="label">Select Employee</label>
              <select className="input" value={empCreateForm.employee_id} onChange={e => setEmpCreateForm(f => ({ ...f, employee_id: e.target.value }))}>
                <option value="">— Select an employee —</option>
                {empWithoutAccess.map((e: any) => (
                  <option key={e.id} value={e.id}>{e.employee_name} {e.position ? `— ${e.position}` : ''}</option>
                ))}
              </select>
              {empWithoutAccess.length === 0 && <p className="text-xs text-slate-400 mt-1">All active employees already have portal access.</p>}
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input font-mono" value={empCreateForm.username} onChange={e => setEmpCreateForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. john.doe" />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input font-mono pr-20"
                  type={empShowPass ? 'text' : 'password'}
                  value={empCreateForm.password}
                  onChange={e => setEmpCreateForm(f => ({ ...f, password: e.target.value }))}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button type="button" onClick={() => setEmpShowPass(!empShowPass)} className="p-1 text-slate-400 hover:text-slate-600">
                    {empShowPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" onClick={() => setEmpCreateForm(f => ({ ...f, password: generatePassword() }))} className="p-1 text-slate-400 hover:text-emerald-600" title="Generate">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">Share this password with the employee. It will be shown once after creation.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowEmpCreateModal(false)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={createEmpCredential} disabled={empCreatingCred} className="flex-1 btn-primary">
                {empCreatingCred ? 'Creating...' : 'Create Access'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Access Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Create Portal Access</h3>
            <div>
              <label className="label">Select Client</label>
              <select className="input" value={createForm.client_id} onChange={e => setCreateForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">— Select a client —</option>
                {clientsWithoutAccess.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
                ))}
              </select>
              {clientsWithoutAccess.length === 0 && <p className="text-xs text-slate-400 mt-1">All clients already have portal access.</p>}
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input font-mono" value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. john.doe" />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input font-mono pr-20"
                  type={showPass ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button type="button" onClick={() => setShowPass(!showPass)} className="p-1 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button type="button" onClick={() => setCreateForm(f => ({ ...f, password: generatePassword() }))} className="p-1 text-slate-400 hover:text-indigo-600" title="Generate">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">Share this password with the client. It will be shown once after creation.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={createCredential} disabled={creatingCred} className="flex-1 btn-primary">
                {creatingCred ? 'Creating...' : 'Create Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
