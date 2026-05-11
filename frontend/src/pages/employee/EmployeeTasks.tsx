import { useState, useEffect } from 'react'
import { employeeTaskApi } from '../../services/api'
import {
  CheckSquare, Play, Pause, CheckCircle, AlertTriangle, Clock,
  Bell, X, Link2, ExternalLink, Filter, ChevronDown, Trophy
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────
function formatTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function getDisplaySecs(task: any): number {
  let total = task.total_seconds || 0
  if (task.timer_status === 'running' && task.timer_started_at) {
    total += Math.max(0, Math.floor((Date.now() - new Date(task.timer_started_at).getTime()) / 1000))
  }
  return total
}

const PRIORITY_MAP: Record<number, { label: string; dot: string; border: string }> = {
  1: { label: 'Critical', dot: 'bg-red-500',    border: 'border-red-200' },
  2: { label: 'High',     dot: 'bg-orange-500', border: 'border-orange-200' },
  3: { label: 'Medium',   dot: 'bg-yellow-500', border: 'border-yellow-200' },
  4: { label: 'Low',      dot: 'bg-blue-400',   border: 'border-blue-200' },
  5: { label: 'Minimal',  dot: 'bg-slate-400',  border: 'border-slate-200' },
}

const STATUS_TABS = [
  { key: 'all',         label: 'All Tasks' },
  { key: 'pending',     label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'on_hold',     label: 'On Hold' },
  { key: 'completed',   label: 'Completed' },
  { key: 'overdue',     label: 'Overdue' },
]

// ── Main Component ───────────────────────────────────────────────────────────
export default function EmployeeTasks() {
  const [tasks, setTasks]       = useState<any[]>([])
  const [notices, setNotices]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [statusTab, setStatusTab] = useState('all')
  const [ticks, setTicks]       = useState(0)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const [completeModal, setCompleteModal] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState<number|null>(null)

  // Ticker for live timer
  useEffect(() => {
    const id = setInterval(() => setTicks(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [tasksRes, noticesRes] = await Promise.all([
        employeeTaskApi.list(),
        employeeTaskApi.notices().catch(() => ({ data: [] })),
      ])
      setTasks(tasksRes.data || [])
      setNotices(noticesRes.data || [])
    } catch { toast.error('Failed to load tasks') }
    finally { setLoading(false) }
  }

  async function timerAction(taskId: number, action: 'start'|'hold'|'resume'|'complete') {
    setActionLoading(taskId)
    try {
      let res: any
      if (action === 'start')    res = await employeeTaskApi.start(taskId)
      else if (action === 'hold')    res = await employeeTaskApi.hold(taskId)
      else if (action === 'resume')  res = await employeeTaskApi.resume(taskId)
      else                           res = await employeeTaskApi.complete(taskId)

      const updated = res.data.task || res.data
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
      setCompleteModal(null)
      if (action === 'complete') toast.success('Task completed! 🎉')
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Action failed')
    } finally { setActionLoading(null) }
  }

  // Filtered tasks
  const filteredTasks = tasks.filter(t => statusTab === 'all' || t.status === statusTab)

  // Analytics
  const totalTasks     = tasks.length
  const completedCount = tasks.filter(t => t.status === 'completed').length
  const overdueCount   = tasks.filter(t => t.status === 'overdue').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const totalSecs      = tasks.reduce((sum, t) => sum + (t.total_seconds || 0), 0)

  // Active notices (not dismissed)
  const activeNotices = notices.filter(n => !dismissed.has(n.id))

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare size={20} className="text-emerald-500" />
          My Tasks
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Track your work and time</p>
      </div>

      {/* Notices */}
      {activeNotices.map(n => (
        <div key={n.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Bell size={15} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">{n.title}</p>
            <p className="text-xs text-amber-700 mt-0.5">{n.message}</p>
          </div>
          <button onClick={() => setDismissed(prev => new Set([...prev, n.id]))} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Analytics strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">Total Tasks</p>
          <p className="text-2xl font-bold text-slate-800">{totalTasks}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{completedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 mb-1">Total Time</p>
          <p className="text-lg font-bold text-slate-700 font-mono">
            {Math.floor(totalSecs / 3600)}h {Math.floor((totalSecs % 3600) / 60)}m
          </p>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            You have {overdueCount} overdue task{overdueCount > 1 ? 's' : ''}. Please contact your manager.
          </p>
        </div>
      )}

      {/* Status tabs */}
      <div className="flex overflow-x-auto gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit max-w-full">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusTab === tab.key
                ? tab.key === 'overdue' ? 'bg-red-500 text-white'
                  : tab.key === 'completed' ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-600 text-white'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                statusTab === tab.key ? 'bg-white/20' : 'bg-slate-100 text-slate-600'
              }`}>
                {tasks.filter(t => t.status === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm py-16 text-center">
          <CheckSquare size={32} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-400 text-sm">
            {statusTab === 'all' ? 'No tasks assigned yet' : `No ${statusTab.replace('_',' ')} tasks`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => <TaskCard key={task.id} task={task} ticks={ticks} onAction={timerAction} actionLoading={actionLoading} onComplete={() => setCompleteModal(task)} />)}
        </div>
      )}

      {/* Complete confirmation modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy size={24} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800 mb-1">Complete Task?</h2>
            <p className="text-sm text-slate-500 mb-1">"{completeModal.title}"</p>
            <p className="text-xs text-slate-400 mb-5">
              Total time logged: {formatTime(getDisplaySecs(completeModal))}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCompleteModal(null)} className="flex-1 btn-secondary">Cancel</button>
              <button
                onClick={() => timerAction(completeModal.id, 'complete')}
                disabled={actionLoading === completeModal.id}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                {actionLoading === completeModal.id ? 'Completing…' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TaskCard subcomponent ──────────────────────────────────────────────────
function TaskCard({ task, ticks, onAction, actionLoading, onComplete }: {
  task: any
  ticks: number
  onAction: (id: number, action: 'start'|'hold'|'resume') => void
  actionLoading: number | null
  onComplete: () => void
}) {
  void ticks // reference ticks to re-render every second
  const displaySecs = getDisplaySecs(task)
  const isRunning   = task.timer_status === 'running'
  const isOverdue   = task.status === 'overdue'
  const isCompleted = task.status === 'completed'
  const isOnHold    = task.status === 'on_hold'
  const isPending   = task.status === 'pending'
  const loading     = actionLoading === task.id

  const priority = PRIORITY_MAP[task.priority] || PRIORITY_MAP[3]

  const resources: any[] = task.resources || []

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
      isOverdue   ? 'border-red-200 bg-red-50/30' :
      isCompleted ? 'border-emerald-100 opacity-75' :
      isRunning   ? 'border-emerald-300 shadow-emerald-50 shadow-md' :
      priority.border
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Priority dot */}
          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${priority.dot}`} />

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start gap-2 justify-between">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold leading-snug ${isCompleted ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {task.title}
                </p>
                {task.project_name && (
                  <p className="text-xs text-slate-400 mt-0.5">{task.project_name}</p>
                )}
              </div>

              {/* Status badge */}
              <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                isOverdue   ? 'bg-red-100 text-red-600' :
                isCompleted ? 'bg-emerald-100 text-emerald-600' :
                isRunning   ? 'bg-emerald-100 text-emerald-700' :
                isOnHold    ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-500'
              }`}>
                {isRunning ? '● Running' : task.status.replace('_', ' ')}
              </span>
            </div>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{task.description}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-3 mt-2">
              {task.due_date && (
                <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                  <Clock size={10} />
                  Due {task.due_date}{task.due_time ? ` ${task.due_time}` : ''}
                </span>
              )}
              <span className="text-xs text-slate-400">{priority.label} priority</span>
            </div>

            {/* Resource links */}
            {resources.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {resources.map((r: any, i: number) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors"
                  >
                    <Link2 size={10} />
                    {r.name || 'Link'}
                    <ExternalLink size={9} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timer footer (not for completed/overdue) */}
      {!isCompleted && !isOverdue && (
        <div className={`flex items-center justify-between px-4 py-2.5 border-t ${
          isRunning ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
        }`}>
          {/* Timer display */}
          <div className="flex items-center gap-2">
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <span className={`font-mono text-sm font-bold tracking-wider ${
              isRunning ? 'text-emerald-700' : 'text-slate-400'
            }`}>
              {formatTime(displaySecs)}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {isPending && (
              <button
                onClick={() => onAction(task.id, 'start')}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Play size={11} fill="white" />
                Start
              </button>
            )}
            {isRunning && (
              <>
                <button
                  onClick={() => onAction(task.id, 'hold')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Pause size={11} />
                  Hold
                </button>
                <button
                  onClick={onComplete}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={11} />
                  Done
                </button>
              </>
            )}
            {isOnHold && (
              <>
                <button
                  onClick={() => onAction(task.id, 'resume')}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <Play size={11} fill="white" />
                  Resume
                </button>
                <button
                  onClick={onComplete}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={11} />
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Completed footer */}
      {isCompleted && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border-t border-emerald-100">
          <CheckCircle size={12} className="text-emerald-500" />
          <span className="text-xs text-emerald-700 font-medium">
            Completed · {formatTime(displaySecs)} logged
          </span>
        </div>
      )}

      {/* Overdue footer */}
      {isOverdue && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-t border-red-100">
          <AlertTriangle size={12} className="text-red-500" />
          <span className="text-xs text-red-600 font-medium">Overdue — contact your manager</span>
        </div>
      )}
    </div>
  )
}
