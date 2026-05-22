import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { salaryApi, employeeApi, employeeAdminApi, formatByCurrency, SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS } from '../services/api'
import { useCompanySettings } from '../hooks/useSettings'
import PrimaryCurrencyAmountField, { validatePrimaryAmount, needsPrimaryConversion } from '../components/PrimaryCurrencyAmountField'
import { Plus, Edit2, Trash2, X, Send, Download, CheckCircle, Users2, Zap, Briefcase } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_COLORS: any = { Paid: 'bg-emerald-100 text-emerald-700', Pending: 'bg-amber-100 text-amber-700' }
const EMPTY = { employee_id: '', employee_name: '', position: '', department: '', salary_type: 'Monthly', base_salary: '', bonuses: 0, deductions: 0, net_salary_primary: '', payment_month: format(new Date(), 'yyyy-MM'), payment_date: '', payment_method: 'Bank Transfer', notes: '', currency: 'LKR' }

function CurrencySelector({ value, onChange, options }: { value: string, onChange: (v: string) => void, options: string[] }) {
  return (
    <select className="input" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(c => (
        <option key={c} value={c}>{c} — {CURRENCY_SYMBOLS[c]}</option>
      ))}
    </select>
  )
}

export default function Salaries() {
  const navigate = useNavigate()
  const { allowedCurrencies, defaultCurrency } = useCompanySettings()
  const [records, setRecords] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [empCredMap, setEmpCredMap] = useState<Record<number, any>>({})
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [tab, setTab] = useState<'payments'|'employees'>('payments')
  const [modal, setModal] = useState(false)
  const [empModal, setEmpModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({ ...EMPTY, currency: defaultCurrency || 'USD' })
  const [empForm, setEmpForm] = useState<any>({ name: '', position: '', department: '', email: '', phone: '', salary_type: 'Monthly', base_salary: '', start_date: '', birthday: '' })

  useEffect(() => { load() }, [filterMonth])

  async function load() {
    const [sr, er, credRes] = await Promise.all([
      salaryApi.list({ month: filterMonth }),
      employeeApi.list(),
      employeeAdminApi.credentials().catch(() => ({ data: [] }))
    ])
    setRecords(sr.data)
    setEmployees(er.data)
    const map: Record<number, any> = {}
    ;(credRes.data as any[]).forEach((c: any) => { map[c.employee_id] = c })
    setEmpCredMap(map)
  }

  function selectEmployee(empId: string) {
    const emp = employees.find(e => e.id === parseInt(empId))
    if (emp) setForm((f: any) => ({ ...f, employee_id: emp.id, employee_name: emp.name, position: emp.position || '', department: emp.department || '', salary_type: emp.salary_type || 'Monthly', base_salary: emp.base_salary || 0 }))
  }

  function openNew() { setEditing(null); setForm({ ...EMPTY, currency: defaultCurrency || 'USD' }); setModal(true) }
  function openEdit(r: any) { setEditing(r); setForm({ ...r, currency: r.currency || defaultCurrency || 'USD' }); setModal(true) }

  async function save() {
    const cur = form.currency || defaultCurrency || 'USD'
    const net = (parseFloat(form.base_salary) || 0) + (parseFloat(form.bonuses) || 0) - (parseFloat(form.deductions) || 0)
    const primaryErr = validatePrimaryAmount(cur, defaultCurrency, form.net_salary_primary)
    if (primaryErr) { toast.error(primaryErr); return }
    const payload = { ...form }
    if (!needsPrimaryConversion(cur, defaultCurrency)) payload.net_salary_primary = net
    try {
      if (editing) await salaryApi.update(editing.id, payload)
      else await salaryApi.create(payload)
      toast.success(editing ? 'Updated' : 'Salary record created')
      setModal(false); load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  async function pay(r: any) {
    const t = toast.loading('Processing payment...')
    try {
      const res = await salaryApi.pay(r.id)
      toast.success(res.data.message, { id: t })
      load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error', { id: t }) }
  }

  async function sendSlip(r: any) {
    const emp = employees.find(e => e.id === r.employee_id)
    if (!emp?.email) { toast.error('No email for this employee'); return }
    const t = toast.loading('Sending slip...')
    try {
      await salaryApi.sendSlip(r.id)
      toast.success(`Slip sent to ${emp.email}`, { id: t })
    } catch (err: any) { toast.error(err.response?.data?.error || 'Send failed', { id: t }) }
  }

  async function downloadSlip(r: any) {
    try {
      const res = await salaryApi.downloadPdf(r.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `SalarySlip-${r.employee_name}-${r.payment_month}.pdf`; a.click()
    } catch { toast.error('Download failed') }
  }

  async function generatePayroll() {
    const t = toast.loading('Generating payroll...')
    try {
      const res = await salaryApi.generate(filterMonth)
      toast.success(res.data.message, { id: t }); load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error', { id: t }) }
  }

  async function del(r: any) {
    if (!confirm('Delete this record?')) return
    await salaryApi.delete(r.id); toast.success('Deleted'); load()
  }

  async function saveEmployee() {
    try {
      if (editing && tab === 'employees') await employeeApi.update(editing.id, empForm)
      else await employeeApi.create(empForm)
      toast.success('Employee saved')
      setEmpModal(false); setEditing(null); load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const netPaid = records.filter(r => r.status === 'Paid').reduce((s, r) => s + Number(r.net_salary_primary != null ? r.net_salary_primary : r.net_salary), 0)
  const netPending = records.filter(r => r.status === 'Pending').reduce((s, r) => s + Number(r.net_salary_primary != null ? r.net_salary_primary : r.net_salary), 0)

  return (
    <div className="space-y-5 fade-in">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['payments','employees'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${tab === t ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t}</button>
        ))}
      </div>

      {tab === 'payments' && <>
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-xs text-slate-500">Paid This Month</p><p className="text-xl font-bold text-emerald-600 mt-1">{formatByCurrency(netPaid, defaultCurrency)}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-500">Pending</p><p className="text-xl font-bold text-amber-500 mt-1">{formatByCurrency(netPending, defaultCurrency)}</p></div>
          <div className="card p-4"><p className="text-xs text-slate-500">Total Employees</p><p className="text-xl font-bold text-slate-700 mt-1">{employees.filter(e => e.status === 'Active').length}</p></div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input type="month" className="input w-40" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={generatePayroll} className="btn-secondary"><Zap size={15} /> Auto-Generate</button>
            <button onClick={openNew} className="btn-primary"><Plus size={16} /> Add Record</button>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                <th className="table-header text-left">Employee</th>
                <th className="table-header text-left">Position</th>
                <th className="table-header text-center">Currency</th>
                <th className="table-header text-right">Basic</th>
                <th className="table-header text-right">Bonuses</th>
                <th className="table-header text-right">Deductions</th>
                <th className="table-header text-right">Net Salary</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header text-center">Slip Sent</th>
                <th className="table-header text-center">Actions</th>
              </tr></thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-slate-400">No salary records. Click "Auto-Generate" to create from employees.</td></tr>
                ) : records.map(r => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell font-medium">{r.employee_name}</td>
                    <td className="table-cell text-slate-500 text-xs">{r.position || '-'}</td>
                    <td className="table-cell text-center"><span className="badge bg-slate-100 text-slate-700 font-mono">{r.currency || 'LKR'}</span></td>
                    <td className="table-cell text-right">{CURRENCY_SYMBOLS[r.currency] || 'Rs.'} {Number(r.base_salary).toLocaleString()}</td>
                    <td className="table-cell text-right text-emerald-600">+{CURRENCY_SYMBOLS[r.currency] || 'Rs.'} {Number(r.bonuses).toLocaleString()}</td>
                    <td className="table-cell text-right text-red-500">-{CURRENCY_SYMBOLS[r.currency] || 'Rs.'} {Number(r.deductions).toLocaleString()}</td>
                    <td className="table-cell text-right font-bold text-slate-800">{formatByCurrency(Number(r.net_salary_primary != null ? r.net_salary_primary : r.net_salary), defaultCurrency)}</td>
                    <td className="table-cell text-center"><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                    <td className="table-cell text-center">{r.slip_sent ? <span className="text-emerald-500 text-xs">✓ Sent</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {r.status === 'Pending' && <button onClick={() => pay(r)} className="p-1.5 text-slate-400 hover:text-emerald-500 rounded" title="Process & Pay"><CheckCircle size={14} /></button>}
                        <button onClick={() => sendSlip(r)} className="p-1.5 text-slate-400 hover:text-blue-500 rounded" title="Send Slip"><Send size={14} /></button>
                        <button onClick={() => downloadSlip(r)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded" title="Download PDF"><Download size={14} /></button>
                        <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-primary rounded"><Edit2 size={14} /></button>
                        <button onClick={() => del(r)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {tab === 'employees' && <>
        <div className="flex justify-end">
          <button onClick={() => { setEditing(null); setEmpForm({ name:'',position:'',department:'',email:'',phone:'',salary_type:'Monthly',base_salary:'',start_date:'',birthday:'' }); setEmpModal(true) }} className="btn-primary"><Plus size={16} /> Add Employee</button>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                <th className="table-header text-left">Name</th>
                <th className="table-header text-left">Position</th>
                <th className="table-header text-left">Department</th>
                <th className="table-header text-left">Email</th>
                <th className="table-header text-right">Base Salary</th>
                <th className="table-header text-center">Type</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header text-center">Portal</th>
                <th className="table-header text-center">Actions</th>
              </tr></thead>
              <tbody>
                {employees.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">No employees added yet</td></tr>
                  : employees.map(e => {
                    const cred = empCredMap[e.id]
                    return (
                    <tr key={e.id} className="table-row">
                      <td className="table-cell font-medium">{e.name}</td>
                      <td className="table-cell text-slate-500">{e.position || '-'}</td>
                      <td className="table-cell text-slate-500">{e.department || '-'}</td>
                      <td className="table-cell text-xs text-slate-400">{e.email || '-'}</td>
                      <td className="table-cell text-right font-semibold">{formatByCurrency(e.base_salary, defaultCurrency)}</td>
                      <td className="table-cell text-center"><span className="badge bg-blue-100 text-blue-700">{e.salary_type}</span></td>
                      <td className="table-cell text-center"><span className={`badge ${e.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{e.status}</span></td>
                      <td className="table-cell text-center">
                        <button
                          onClick={() => navigate('/settings', { state: { tab: 'employee' } })}
                          title="Manage employee portal access"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors hover:opacity-80 ${cred ? (cred.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500') : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}
                        >
                          <Briefcase size={10} />
                          {cred ? (cred.is_active ? 'Active' : 'Disabled') : 'No Access'}
                        </button>
                      </td>
                      <td className="table-cell">
                        <div className="flex justify-center gap-1.5">
                          <button onClick={() => { setEditing(e); setEmpForm(e); setEmpModal(true) }} className="p-1.5 text-slate-400 hover:text-primary rounded"><Edit2 size={14} /></button>
                          <button onClick={async () => { if(confirm('Delete?')){await employeeApi.delete(e.id);load()} }} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {/* Salary Payment Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold">{editing ? 'Edit Salary' : 'Add Salary Record'}</h2>
              <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {!editing && <div><label className="label">Select Employee</label>
                <select className="input" onChange={e => selectEmployee(e.target.value)} defaultValue="">
                  <option value="">-- Select employee --</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.position || 'No position'})</option>)}
                </select>
              </div>}
              <div className="form-grid">
                <div><label className="label">Employee Name *</label><input className="input" value={form.employee_name} onChange={e => setForm({...form, employee_name: e.target.value})} /></div>
                <div><label className="label">Position</label><input className="input" value={form.position} onChange={e => setForm({...form, position: e.target.value})} /></div>
                <div><label className="label">Department</label><input className="input" value={form.department} onChange={e => setForm({...form, department: e.target.value})} /></div>
                <div><label className="label">Payment Month</label><input className="input" type="month" value={form.payment_month} onChange={e => setForm({...form, payment_month: e.target.value})} /></div>
                <div><label className="label">Currency</label><CurrencySelector value={form.currency || defaultCurrency || 'USD'} options={allowedCurrencies.length ? allowedCurrencies : SUPPORTED_CURRENCIES} onChange={v => setForm({...form, currency: v, net_salary_primary: v === defaultCurrency ? '' : form.net_salary_primary})} /></div>
                <div><label className="label">Basic Salary ({CURRENCY_SYMBOLS[form.currency] || 'Rs.'})</label><input className="input" type="number" value={form.base_salary} onChange={e => setForm({...form, base_salary: e.target.value})} /></div>
                <div><label className="label">Bonuses ({CURRENCY_SYMBOLS[form.currency] || 'Rs.'})</label><input className="input" type="number" value={form.bonuses} onChange={e => setForm({...form, bonuses: e.target.value})} /></div>
                <div><label className="label">Deductions ({CURRENCY_SYMBOLS[form.currency] || 'Rs.'})</label><input className="input" type="number" value={form.deductions} onChange={e => setForm({...form, deductions: e.target.value})} /></div>
                <div><label className="label">Net Salary</label>
                  <div className="input bg-slate-50 font-bold text-emerald-600">
                    {CURRENCY_SYMBOLS[form.currency] || 'Rs.'} {((parseFloat(form.base_salary)||0)+(parseFloat(form.bonuses)||0)-(parseFloat(form.deductions)||0)).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <PrimaryCurrencyAmountField
                  currency={form.currency || defaultCurrency}
                  primaryCurrency={defaultCurrency}
                  value={form.net_salary_primary}
                  onChange={v => setForm({ ...form, net_salary_primary: v })}
                  label="net salary"
                />
                <div><label className="label">Payment Method</label>
                  <select className="input" value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})}>
                    {['Bank Transfer','Cash','Check','Online'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label className="label">Payment Date</label><input className="input" type="date" value={form.payment_date} onChange={e => setForm({...form, payment_date: e.target.value})} /></div>
                <div className="form-full"><label className="label">Notes</label><textarea className="input h-14 resize-none" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={save} className="btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {empModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEmpModal(false)}>
          <div className="modal-content">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setEmpModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="form-grid">
                <div><label className="label">Name *</label><input className="input" value={empForm.name} onChange={e => setEmpForm({...empForm, name: e.target.value})} /></div>
                <div><label className="label">Position</label><input className="input" value={empForm.position} onChange={e => setEmpForm({...empForm, position: e.target.value})} /></div>
                <div><label className="label">Department</label><input className="input" value={empForm.department} onChange={e => setEmpForm({...empForm, department: e.target.value})} /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={empForm.email} onChange={e => setEmpForm({...empForm, email: e.target.value})} /></div>
                <div><label className="label">Phone</label><input className="input" value={empForm.phone} onChange={e => setEmpForm({...empForm, phone: e.target.value})} /></div>
                <div><label className="label">Salary Type</label>
                  <select className="input" value={empForm.salary_type} onChange={e => setEmpForm({...empForm, salary_type: e.target.value})}>
                    {['Monthly','Project','Hourly'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Base Salary (Rs.)</label><input className="input" type="number" value={empForm.base_salary} onChange={e => setEmpForm({...empForm, base_salary: e.target.value})} /></div>
                <div><label className="label">Start Date</label><input className="input" type="date" value={empForm.start_date} onChange={e => setEmpForm({...empForm, start_date: e.target.value})} /></div>
                <div><label className="label">Birthday</label><input className="input" type="date" value={empForm.birthday || ''} onChange={e => setEmpForm({...empForm, birthday: e.target.value})} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setEmpModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={saveEmployee} className="btn-primary">Save Employee</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
