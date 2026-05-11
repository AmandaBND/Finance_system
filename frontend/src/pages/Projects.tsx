import { useState, useEffect, useCallback } from 'react'
import { projectApi, clientApi } from '../services/api'
import {
  FolderKanban, Plus, Pencil, Trash2, X, Tag, Search,
  ChevronDown, ChevronUp, Layers, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'hold', label: 'On Hold' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'completed', label: 'Completed' },
]

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  hold:      'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
}

const EMPTY_FORM = {
  name: '', client_id: '' as any, start_date: '',
  status: 'active', type_ids: [] as number[], description: ''
}

export default function Projects() {
  const [projects, setProjects]     = useState<any[]>([])
  const [types, setTypes]           = useState<any[]>([])
  const [clients, setClients]       = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]         = useState('')
  const [typesOpen, setTypesOpen]   = useState(true)
  const [newType, setNewType]       = useState('')
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState<any>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projRes, typeRes, clientRes] = await Promise.all([
        projectApi.list({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search || undefined,
        }),
        projectApi.types(),
        clientApi.list(),
      ])
      setProjects(projRes.data)
      setTypes(typeRes.data)
      setClients(clientRes.data)
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  // ── Type management ─────────────────────────────────────────────────────
  async function addType() {
    if (!newType.trim()) return
    try {
      await projectApi.addType({ name: newType.trim() })
      setNewType('')
      load()
      toast.success('Type added')
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  async function removeType(id: number) {
    try { await projectApi.deleteType(id); load(); toast.success('Type removed') }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  // ── Project CRUD ─────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setModal({ mode: 'add' })
  }

  function openEdit(p: any) {
    setForm({
      name: p.name, client_id: p.client_id || '',
      start_date: p.start_date || '', status: p.status,
      type_ids: (() => { try { return JSON.parse(p.type_ids || '[]') } catch { return [] } })(),
      description: p.description || '',
    })
    setModal({ mode: 'edit', id: p.id })
  }

  async function save() {
    if (!form.name.trim()) return toast.error('Project name is required')
    setSaving(true)
    try {
      if (modal.mode === 'add') {
        await projectApi.create(form)
        toast.success('Project created')
      } else {
        await projectApi.update(modal.id, form)
        toast.success('Project updated')
      }
      setModal(null)
      load()
    } catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
    finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Delete this project and all its tasks?')) return
    try { await projectApi.delete(id); toast.success('Project deleted'); load() }
    catch (e: any) { toast.error(e.response?.data?.error || 'Error') }
  }

  function toggleType(id: number) {
    setForm(f => ({
      ...f,
      type_ids: f.type_ids.includes(id)
        ? f.type_ids.filter(x => x !== id)
        : [...f.type_ids, id]
    }))
  }

  function getTypeName(id: number) {
    return types.find(t => t.id === id)?.name || ''
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FolderKanban size={20} className="text-primary" />
            Projects
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage all client projects</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Project Types panel */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setTypesOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Tag size={14} className="text-slate-500" />
            Project Types
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{types.length}</span>
          </div>
          {typesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {typesOpen && (
          <div className="px-5 pb-4 border-t border-slate-50">
            <div className="flex flex-wrap gap-2 mt-3">
              {types.map(t => (
                <span key={t.id} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-full">
                  {t.name}
                  <button onClick={() => removeType(t.id)} className="text-slate-400 hover:text-red-500 ml-0.5 transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-full px-2 py-1">
                <input
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addType()}
                  placeholder="Add type..."
                  className="text-xs w-24 outline-none bg-transparent text-slate-600 placeholder-slate-400"
                />
                <button onClick={addType} className="text-primary hover:text-primary/80">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="input pl-8 text-sm h-9"
          />
        </div>
      </div>

      {/* Projects table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-16 text-center">
            <FolderKanban size={32} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm">No projects found</p>
            <button onClick={openAdd} className="mt-3 text-primary text-sm font-medium hover:underline">
              Create your first project →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-semibold">Project</th>
                  <th className="px-4 py-3 text-left font-semibold">Client</th>
                  <th className="px-4 py-3 text-left font-semibold">Start Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Types</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Tasks</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projects.map((p: any) => {
                  const typeIds = (() => { try { return JSON.parse(p.type_ids || '[]') } catch { return [] } })()
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">{p.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{p.client_name || '—'}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{p.start_date || '—'}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {typeIds.length === 0 ? <span className="text-slate-300 text-xs">—</span> : typeIds.map((tid: number) => (
                            <span key={tid} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                              {getTypeName(tid)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-600'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Layers size={12} />
                          <span>{p.completed_tasks || 0}/{p.task_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => del(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                {modal.mode === 'add' ? 'New Project' : 'Edit Project'}
              </h2>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Project Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="e.g. Website Redesign"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Client */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client</label>
                  <select
                    value={form.client_id}
                    onChange={e => setForm(f => ({ ...f, client_id: e.target.value ? Number(e.target.value) : '' }))}
                    className="input"
                  >
                    <option value="">No client</option>
                    {clients.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="input"
                  >
                    <option value="active">Active</option>
                    <option value="hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="input"
                />
              </div>

              {/* Types */}
              {types.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Project Types</label>
                  <div className="flex flex-wrap gap-2">
                    {types.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleType(t.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                          form.type_ids.includes(t.id)
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50'
                        }`}
                      >
                        {form.type_ids.includes(t.id) && <CheckCircle2 size={11} />}
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="input resize-none"
                  placeholder="Optional project description..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : modal.mode === 'add' ? 'Create Project' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
