import { useState, useEffect, useCallback } from 'react'
import {
  taskAdminApi, projectApi, employeeApi
} from '../services/api'
import {
  CheckSquare, Plus, Pencil, Trash2, X, ChevronLeft, ChevronRight,
  Bell, Calendar, List, AlertTriangle, Link2, Clock, Users
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ─────────────────────────────────────────────────────────────────
const PRIORITY_MAP: Record<number, { label: string; cls: string }> = {
  1: { label: 'Critical', cls: 'bg-red-100 text-red-700' },
  2: { label: 'High',     cls: 'bg-orange-100 text-orange-700' },
  3: { label: 'Medium',   cls: 'bg-yellow-100 text-yellow-700' },
  4: { label: 'Low',      cls: 'bg-blue-100 text-blue-700' },
  5: { label: 'Minimal',  cls: 'bg-slate-100 text-slate-500' },
}

const STATUS_MAP: Record<string, string> = {
  pending:     'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  on_hold:     'bg-amber-100 text-amber-700',
  completed:   'bg-emerald-100 text-emerald-700',
  overdue:     'bg-red-100 text-red-700',
}

const EVENT_COLORS: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-emerald-100 text-emerald-700',
  red:    'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  purple: 'bg-purple-100 text-purple-700',
}

function fmtSecs(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const EMPTY_TASK = {
  title: '', description: '', project_id: '' as any, assigned_to: '' as any,
  start_date: '', due_date: '', due_time: '', submission_link: '',
  priority: 3, status: 'pending',
  resources: [] as { name: string; url: string }[],
}

const EMPTY_EVENT = { title: '', event_date: '', event_time: '', color: 'blue', description: '' }
const EMPTY_NOTICE = { title: '', message: '', target: 'all', employee_ids: [] as number[] }

// ── Main Component ────────────────────────────────────────────────────────────
export default function Tasks() {
  const [tab, setTab] = useState<'tasks'|'calendar'|'notices'>('tasks')
  const [tasks, setTasks]       = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  // Task filters
  const [fProject, setFProject]   = useState('')
  const [fEmployee, setFEmployee] = useState('')
  const [fStatus, setFStatus]     = useState('all')

  // Task modal
  const [taskModal, setTaskModal] = useState<any>(null)
  const [taskForm, setTaskForm]   = useState({ ...EMPTY_TASK })
  const [saving, setSaving]       = useState(false)

  // Calendar state
  const [calMonth, setCalMonth]   = useState(() => new Date().toISOString().slice(0, 7))
  const [calData, setCalData]     = useState<{ tasks: any[]; events: any[] }>({ tasks: [], events: [] })
  const [calLoading, setCalLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)
  const [eventModal, setEventModal] = useState<any>(null)
  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT })

  // Notices
  const [notices, setNotices]     = useState<any[]>([])
  const [noticeModal, setNoticeModal] = useState<any>(null)
  const [noticeForm, setNoticeForm] = useState({ ...EMPTY_NOTICE })

  useEffect(() => {
    Promise.all([projectApi.list(), employeeApi.list()])
      .then(([p, e]) => { setProjects(p.data); setEmployees(e.data) })
      .catch(() => {})
  }, [])

  // Tab-specific loads
  useEffect(() => { if (tab === 'tasks') loadTasks() }, [tab, fProject, fEmployee, fStatus])
  useEffect(() => { if (tab === 'calendar') loadCalendar() }, [tab, calMonth])
  useEffect(() => { if (tab === 'notices') loadNotices() }, [tab])

  async function loadTasks() {
    setLoading(true)
    try {
      const res = await taskAdminApi.list({
        project_id:  fProject  || undefined,
        assigned_to: fEmployee || undefined,
        status:      fStatus !== 'all' ? fStatus : undefined,
      })
      setTasks(res.data)
    } catch { toast.error('Failed to load tasks') }
    finally { setLoading(false) }
  }

  async function loadCalendar() {
    setCalLoading(true)
    try {
      const res = await taskAdminApi.calendar(calMonth)
      setCalData(res.data)
    } catch { toast.error('Failed to load calendar') }
    finally { setCalLoading(false) }
  }

  async function loadNotices() {
    try { const res = await taskAdminApi.listNotices(); setNotices(res.data) }
    catch { toast.error('Failed to load notices') }
  }

  // ── Task CRUD ──────────────────────────────────────────────────────────────
  function openAddTask() {
    setTaskForm({ ...EMPTY_TASK })
    setTaskModal({ mode: 'add' })
  }
  function openEditTask(t: any) {
    setTaskForm({
      title: t.title, description: t.description || '',
      project_id: t.project_id || '', assigned_to: t.assigned_to || '',
      start_date: t.start_date || '', due_date: t.due_date || '',
      due_time: t.due_time || '', submission_link: t.submission_link || '',
      priority: t.priority || 3, status: t.status,
      resources: t.resources || [],
    })
    setTaskModal({ mode: 'edit', id: t.id })
  }

  async function saveTask() {
    if (!taskForm.title.trim()) return toast.error('Task title required')
    if (!taskForm.assigned_to) return toast.error('Assign to an employee')
    setSaving(true)
    try {
      if (taskModal.mode === 'add') {
        await taskAdminApi.create(taskForm)
        toast.success('Task created')
      } else {
        await taskAdminApi.update(taskModal.id, taskForm)
        toast.success('Task updated')
      }
      setTaskModal(null)
      loadTasks()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  async function delTask(id: number) {
    if (!confirm('Delete this task?')) return
    try { await taskAdminApi.delete(id); toast.success('Task deleted'); loadTasks() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  async function setTaskStatus(id: number, status: string) {
    try { await taskAdminApi.setStatus(id, status); loadTasks(); toast.success('Status updated') }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  function addResource() {
    setTaskForm(f => ({ ...f, resources: [...f.resources, { name: '', url: '' }] }))
  }
  function removeResource(i: number) {
    setTaskForm(f => ({ ...f, resources: f.resources.filter((_, idx) => idx !== i) }))
  }
  function updateResource(i: number, field: 'name'|'url', val: string) {
    setTaskForm(f => ({
      ...f,
      resources: f.resources.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    }))
  }

  // ── Calendar helpers ───────────────────────────────────────────────────────
  function buildCalendarGrid() {
    const [year, month] = calMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const cells: (string | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${calMonth}-${String(d).padStart(2, '0')}`)
    }
    return cells
  }

  function getTasksForDay(date: string) {
    return calData.tasks.filter(t => t.due_date === date || t.start_date === date)
  }
  function getEventsForDay(date: string) {
    return calData.events.filter(e => e.event_date === date)
  }

  function prevMonth() {
    const d = new Date(calMonth + '-01')
    d.setMonth(d.getMonth() - 1)
    setCalMonth(d.toISOString().slice(0, 7))
    setSelectedDay(null)
  }
  function nextMonth() {
    const d = new Date(calMonth + '-01')
    d.setMonth(d.getMonth() + 1)
    setCalMonth(d.toISOString().slice(0, 7))
    setSelectedDay(null)
  }

  // ── Event CRUD ─────────────────────────────────────────────────────────────
  function openAddEvent(date?: string) {
    setEventForm({ ...EMPTY_EVENT, event_date: date || '' })
    setEventModal({ mode: 'add' })
  }
  function openEditEvent(ev: any) {
    setEventForm({ title: ev.title, event_date: ev.event_date, event_time: ev.event_time || '', color: ev.color || 'blue', description: ev.description || '' })
    setEventModal({ mode: 'edit', id: ev.id })
  }
  async function saveEvent() {
    if (!eventForm.title.trim() || !eventForm.event_date) return toast.error('Title and date required')
    try {
      if (eventModal.mode === 'add') { await taskAdminApi.createEvent(eventForm); toast.success('Event added') }
      else { await taskAdminApi.updateEvent(eventModal.id, eventForm); toast.success('Event updated') }
      setEventModal(null)
      loadCalendar()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  async function delEvent(id: number) {
    if (!confirm('Delete event?')) return
    try { await taskAdminApi.deleteEvent(id); toast.success('Event deleted'); loadCalendar(); setSelectedDay(null) }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  // ── Notice CRUD ────────────────────────────────────────────────────────────
  function openAddNotice() { setNoticeForm({ ...EMPTY_NOTICE }); setNoticeModal({ mode: 'add' }) }
  function openEditNotice(n: any) {
    setNoticeForm({ title: n.title, message: n.message, target: n.target, employee_ids: (() => { try { return JSON.parse(n.employee_ids || '[]') } catch { return [] } })() })
    setNoticeModal({ mode: 'edit', id: n.id })
  }
  async function saveNotice() {
    if (!noticeForm.title.trim() || !noticeForm.message.trim()) return toast.error('Title and message required')
    try {
      if (noticeModal.mode === 'add') { await taskAdminApi.createNotice(noticeForm); toast.success('Notice created') }
      else { await taskAdminApi.updateNotice(noticeModal.id, noticeForm); toast.success('Notice updated') }
      setNoticeModal(null)
      loadNotices()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  async function delNotice(id: number) {
    if (!confirm('Delete notice?')) return
    try { await taskAdminApi.deleteNotice(id); toast.success('Notice deleted'); loadNotices() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }
  async function toggleNoticeActive(n: any) {
    try { await taskAdminApi.updateNotice(n.id, { ...n, is_active: n.is_active ? 0 : 1 }); loadNotices() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  function toggleNoticeEmployee(id: number) {
    setNoticeForm(f => ({
      ...f,
      employee_ids: f.employee_ids.includes(id)
        ? f.employee_ids.filter(x => x !== id)
        : [...f.employee_ids, id]
    }))
  }

  const calCells = buildCalendarGrid()
  const selectedTasks  = selectedDay ? getTasksForDay(selectedDay)  : []
  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare size={20} className="text-primary" />
            Tasks
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage tasks, calendar & notices</p>
        </div>
        {tab === 'tasks' && (
          <button onClick={openAddTask} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New Task
          </button>
        )}
        {tab === 'calendar' && (
          <button onClick={() => openAddEvent()} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Add Event
          </button>
        )}
        {tab === 'notices' && (
          <button onClick={openAddNotice} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New Notice
          </button>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm w-fit">
        {([
          { key: 'tasks', icon: List, label: 'Task List' },
          { key: 'calendar', icon: Calendar, label: 'Calendar' },
          { key: 'notices', icon: Bell, label: 'Notices' },
        ] as const).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: TASKS ──────────────────────────────────────────────────────── */}
      {tab === 'tasks' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <select value={fProject} onChange={e => setFProject(e.target.value)} className="input h-9 text-sm w-48">
              <option value="">All Projects</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={fEmployee} onChange={e => setFEmployee(e.target.value)} className="input h-9 text-sm w-48">
              <option value="">All Employees</option>
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {['all','pending','in_progress','on_hold','completed','overdue'].map(s => (
                <button key={s} onClick={() => setFStatus(s)}
                  className={`px-3 py-2 text-xs font-medium capitalize transition-colors ${fStatus === s ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-16 text-center">
                <CheckSquare size={32} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 text-sm">No tasks found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-5 py-3 text-left font-semibold">Task</th>
                      <th className="px-4 py-3 text-left font-semibold">Project</th>
                      <th className="px-4 py-3 text-left font-semibold">Employee</th>
                      <th className="px-4 py-3 text-left font-semibold">Priority</th>
                      <th className="px-4 py-3 text-left font-semibold">Due</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Timer</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tasks.map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="text-sm font-semibold text-slate-800">{t.title}</p>
                          {(t.resources || []).length > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Link2 size={10} /> {t.resources.length} link{t.resources.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{t.project_name || '—'}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">{t.assigned_name || '—'}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_MAP[t.priority]?.cls || ''}`}>
                            {PRIORITY_MAP[t.priority]?.label || t.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {t.due_date ? <>{t.due_date}{t.due_time ? <span className="text-slate-400 ml-1">{t.due_time}</span> : ''}</> : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <select
                            value={t.status}
                            onChange={e => setTaskStatus(t.id, e.target.value)}
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${STATUS_MAP[t.status] || ''}`}
                          >
                            {['pending','in_progress','on_hold','completed','overdue'].map(s => (
                              <option key={s} value={s} className="text-slate-700 bg-white">{s.replace('_',' ')}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <Clock size={11} />
                            {fmtSecs(t.total_seconds || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEditTask(t)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => delTask(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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
        </>
      )}

      {/* ── TAB: CALENDAR ───────────────────────────────────────────────────── */}
      {tab === 'calendar' && (
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Calendar grid */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
                <ChevronLeft size={16} />
              </button>
              <h3 className="text-sm font-bold text-slate-700">
                {new Date(calMonth + '-15').toLocaleString('en', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
                <ChevronRight size={16} />
              </button>
            </div>

            {calLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-3">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
                  ))}
                </div>
                {/* Cells */}
                <div className="grid grid-cols-7 gap-1">
                  {calCells.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} />
                    const dayTasks  = getTasksForDay(date)
                    const dayEvents = getEventsForDay(date)
                    const isToday   = date === new Date().toISOString().slice(0, 10)
                    const isSelected = date === selectedDay
                    const hasItems   = dayTasks.length + dayEvents.length > 0

                    return (
                      <button
                        key={date}
                        onClick={() => setSelectedDay(date === selectedDay ? null : date)}
                        className={`rounded-lg p-1 min-h-[60px] text-left transition-all border ${
                          isSelected ? 'border-primary bg-primary/5' :
                          isToday    ? 'border-primary/30 bg-primary/5' :
                          hasItems   ? 'border-slate-100 hover:border-slate-200 bg-white' :
                          'border-transparent hover:border-slate-100 bg-white'
                        }`}
                      >
                        <span className={`block text-xs font-bold mb-1 ${
                          isToday ? 'text-primary' : 'text-slate-600'
                        }`}>{Number(date.slice(8))}</span>
                        <div className="space-y-0.5">
                          {dayTasks.slice(0, 2).map(t => (
                            <div key={t.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${PRIORITY_MAP[t.priority]?.cls || 'bg-slate-100 text-slate-600'}`}>
                              {t.title}
                            </div>
                          ))}
                          {dayEvents.slice(0, 2).map(e => (
                            <div key={`ev-${e.id}`} className={`text-[10px] px-1 py-0.5 rounded truncate ${EVENT_COLORS[e.color] || 'bg-blue-100 text-blue-700'}`}>
                              {e.title}
                            </div>
                          ))}
                          {dayTasks.length + dayEvents.length > 2 && (
                            <div className="text-[10px] text-slate-400 px-1">+{dayTasks.length + dayEvents.length - 2} more</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Day detail panel */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-700">
                {selectedDay ? new Date(selectedDay + 'T00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Select a day'}
              </h3>
              {selectedDay && (
                <button onClick={() => openAddEvent(selectedDay)} className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                  <Plus size={12} /> Event
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {!selectedDay ? (
                <p className="text-xs text-slate-400 text-center py-8">Click a day on the calendar to see details</p>
              ) : selectedTasks.length === 0 && selectedEvents.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No tasks or events this day</p>
              ) : (
                <>
                  {selectedTasks.map(t => (
                    <div key={t.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-slate-700">{t.title}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${PRIORITY_MAP[t.priority]?.cls}`}>
                          {PRIORITY_MAP[t.priority]?.label}
                        </span>
                      </div>
                      {t.assigned_name && <p className="text-[10px] text-slate-400">{t.assigned_name}</p>}
                      <span className={`inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_MAP[t.status]}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                  {selectedEvents.map(ev => (
                    <div key={`ev-${ev.id}`} className={`rounded-lg p-3 ${EVENT_COLORS[ev.color] || 'bg-blue-50'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{ev.title}</p>
                          {ev.event_time && <p className="text-[10px] mt-0.5 opacity-70">{ev.event_time}</p>}
                          {ev.description && <p className="text-[10px] mt-0.5 opacity-70 truncate">{ev.description}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEditEvent(ev)} className="p-1 opacity-60 hover:opacity-100 rounded">
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => delEvent(ev.id)} className="p-1 opacity-60 hover:opacity-100 rounded">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: NOTICES ────────────────────────────────────────────────────── */}
      {tab === 'notices' && (
        <div className="space-y-3">
          {notices.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center">
              <Bell size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm">No notices yet</p>
            </div>
          ) : notices.map((n: any) => (
            <div key={n.id} className={`bg-white rounded-xl border shadow-sm p-5 ${n.is_active ? 'border-amber-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Bell size={13} className={n.is_active ? 'text-amber-500' : 'text-slate-400'} />
                    <h3 className="text-sm font-bold text-slate-800">{n.title}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${n.is_active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {n.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize">
                      {n.target === 'all' ? 'All Employees' : 'Specific'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => toggleNoticeActive(n)} className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${n.is_active ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}>
                    {n.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEditNotice(n)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => delNotice(n.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Task Modal ──────────────────────────────────────────────────────── */}
      {taskModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {taskModal.mode === 'add' ? 'New Task' : 'Edit Task'}
              </h2>
              <button onClick={() => setTaskModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title *</label>
                <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} className="input" placeholder="Task title" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Employee */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Assign To *</label>
                  <select value={taskForm.assigned_to} onChange={e => setTaskForm(f => ({ ...f, assigned_to: e.target.value ? Number(e.target.value) : '' }))} className="input">
                    <option value="">Select employee…</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                {/* Project */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Project</label>
                  <select value={taskForm.project_id} onChange={e => setTaskForm(f => ({ ...f, project_id: e.target.value ? Number(e.target.value) : '' }))} className="input">
                    <option value="">No project</option>
                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date</label>
                  <input type="date" value={taskForm.start_date} onChange={e => setTaskForm(f => ({ ...f, start_date: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Due Date</label>
                  <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Due Time</label>
                  <input type="time" value={taskForm.due_time} onChange={e => setTaskForm(f => ({ ...f, due_time: e.target.value }))} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
                  <div className="flex gap-1.5">
                    {[1,2,3,4,5].map(p => (
                      <button key={p} type="button" onClick={() => setTaskForm(f => ({ ...f, priority: p }))}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-colors ${taskForm.priority === p ? PRIORITY_MAP[p].cls + ' border-transparent' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{PRIORITY_MAP[taskForm.priority]?.label}</p>
                </div>
                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
                  <select value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))} className="input">
                    {['pending','in_progress','on_hold','completed','overdue'].map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submission link */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Submission Link</label>
                <input value={taskForm.submission_link} onChange={e => setTaskForm(f => ({ ...f, submission_link: e.target.value }))} className="input" placeholder="https://..." />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input resize-none" placeholder="Optional task description…" />
              </div>

              {/* Resources */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-600">Resource Links</label>
                  <button type="button" onClick={addResource} className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                    <Plus size={11} /> Add
                  </button>
                </div>
                {taskForm.resources.map((r, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input value={r.name} onChange={e => updateResource(i, 'name', e.target.value)} className="input flex-1 text-xs" placeholder="Name" />
                    <input value={r.url}  onChange={e => updateResource(i, 'url',  e.target.value)} className="input flex-2 text-xs" placeholder="URL" />
                    <button type="button" onClick={() => removeResource(i)} className="p-1.5 text-slate-400 hover:text-red-500">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setTaskModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveTask} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : taskModal.mode === 'add' ? 'Create Task' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Event Modal ─────────────────────────────────────────────────────── */}
      {eventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">{eventModal.mode === 'add' ? 'Add Event' : 'Edit Event'}</h2>
              <button onClick={() => setEventModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title *</label>
                <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} className="input" placeholder="Event title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date *</label>
                  <input type="date" value={eventForm.event_date} onChange={e => setEventForm(f => ({ ...f, event_date: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Time</label>
                  <input type="time" value={eventForm.event_time} onChange={e => setEventForm(f => ({ ...f, event_time: e.target.value }))} className="input" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color</label>
                <div className="flex gap-2">
                  {Object.keys(EVENT_COLORS).map(c => (
                    <button key={c} type="button" onClick={() => setEventForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${eventForm.color === c ? 'border-slate-800 scale-110' : 'border-transparent'} ${EVENT_COLORS[c].split(' ')[0]}`} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input resize-none" placeholder="Optional…" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setEventModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveEvent} className="btn-primary">{eventModal.mode === 'add' ? 'Add Event' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notice Modal ─────────────────────────────────────────────────────── */}
      {noticeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">{noticeModal.mode === 'add' ? 'New Notice' : 'Edit Notice'}</h2>
              <button onClick={() => setNoticeModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Title *</label>
                <input value={noticeForm.title} onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))} className="input" placeholder="Notice title" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message *</label>
                <textarea value={noticeForm.message} onChange={e => setNoticeForm(f => ({ ...f, message: e.target.value }))} rows={3} className="input resize-none" placeholder="Notice message…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Target</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setNoticeForm(f => ({ ...f, target: 'all', employee_ids: [] }))}
                    className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${noticeForm.target === 'all' ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    All Employees
                  </button>
                  <button type="button" onClick={() => setNoticeForm(f => ({ ...f, target: 'specific' }))}
                    className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-colors ${noticeForm.target === 'specific' ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Specific Employees
                  </button>
                </div>
              </div>
              {noticeForm.target === 'specific' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Select Employees</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {employees.map((e: any) => (
                      <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={noticeForm.employee_ids.includes(e.id)} onChange={() => toggleNoticeEmployee(e.id)} className="rounded" />
                        <span className="text-sm text-slate-700">{e.name}</span>
                        {e.position && <span className="text-xs text-slate-400">{e.position}</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setNoticeModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveNotice} className="btn-primary">{noticeModal.mode === 'add' ? 'Post Notice' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
