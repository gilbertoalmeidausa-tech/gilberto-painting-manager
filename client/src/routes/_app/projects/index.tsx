import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, FolderKanban, Search, Pencil, Trash2 } from 'lucide-react'
import { apiFetch } from '../../../lib/api'
import { formatCents, formatDate, formatDateInput, parseDateInput } from '../../../lib/formatters'
import { Modal } from '../../../components/Modal'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { StatusBadge } from '../../../components/StatusBadge'
import { Spinner } from '../../../components/Spinner'

export const Route = createFileRoute('/_app/projects/')({
  component: ProjectsPage,
})

interface Client { id: string; name: string }
interface Project {
  id: string; name: string; status: string; description: string | null
  address: string | null; city: string | null; state: string | null
  startDate: string | null; endDate: string | null; totalValueCents: number | null
  notes: string | null; createdAt: string; clientId: string | null
  client: Client | null
}

const PROJECT_STATUSES = ['lead', 'active', 'on_hold', 'completed', 'cancelled'] as const

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  clientId: z.string().uuid().optional().or(z.literal('')),
  status: z.enum(PROJECT_STATUSES).default('lead'),
  description: z.string().optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalValueCents: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
})
type ProjectForm = z.infer<typeof projectSchema>

function ProjectModal({ project, open, onClose }: { project?: Project; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: clientsData } = useQuery({
    queryKey: ['clients-mini'],
    queryFn: () => apiFetch<{ data: Client[] }>('/api/clients?limit=100'),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    values: project ? {
      name: project.name,
      clientId: project.clientId ?? '',
      status: project.status as typeof PROJECT_STATUSES[number],
      description: project.description ?? '',
      address: project.address ?? '',
      city: project.city ?? '',
      state: project.state ?? '',
      zip: '',
      startDate: formatDateInput(project.startDate),
      endDate: formatDateInput(project.endDate),
      totalValueCents: project.totalValueCents ?? 0,
      notes: project.notes ?? '',
    } : undefined,
  })

  async function onSubmit(data: ProjectForm) {
    const body = {
      ...data,
      clientId: data.clientId || undefined,
      startDate: parseDateInput(data.startDate ?? ''),
      endDate: parseDateInput(data.endDate ?? ''),
    }
    const method = project ? 'PUT' : 'POST'
    const url = project ? `/api/projects/${project.id}` : '/api/projects'
    await apiFetch(url, { method, body: JSON.stringify(body) })
    qc.invalidateQueries({ queryKey: ['projects'] })
    onClose()
    reset()
  }

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit Project' : 'New Project'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Project Name *</label>
            <input {...register('name')} className="input" placeholder="Exterior Repaint – 123 Main St" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Client</label>
            <select {...register('clientId')} className="input">
              <option value="">— No client —</option>
              {clientsData?.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea {...register('description')} rows={2} className="input" placeholder="Brief description..." />
          </div>
          <div className="col-span-2">
            <label className="label">Job Address</label>
            <input {...register('address')} className="input" placeholder="123 Main St" />
          </div>
          <div>
            <label className="label">City</label>
            <input {...register('city')} className="input" placeholder="Boston" />
          </div>
          <div>
            <label className="label">State</label>
            <input {...register('state')} className="input" placeholder="MA" />
          </div>
          <div>
            <label className="label">Start Date</label>
            <input {...register('startDate')} type="date" className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input {...register('endDate')} type="date" className="input" />
          </div>
          <div>
            <label className="label">Contract Value (cents)</label>
            <input {...register('totalValueCents')} type="number" min="0" className="input" placeholder="0" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea {...register('notes')} rows={2} className="input" placeholder="Internal notes..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Spinner size="sm" /> : project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ProjectsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Project | undefined>()
  const qc = useQueryClient()

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (q) params.set('q', q)
  if (statusFilter) params.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, q, statusFilter],
    queryFn: () => apiFetch<{ data: Project[]; meta: { total: number } }>(`/api/projects?${params}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.meta.total ?? 0} total projects</p>
        </div>
        <button onClick={() => { setEditing(undefined); setModalOpen(true) }} className="btn-primary">
          <Plus className="h-4 w-4" />New Project
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <form onSubmit={(e) => { e.preventDefault(); setQ(search); setPage(1) }} className="flex gap-2 flex-1 min-w-48">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="input pl-9" />
          </div>
          <button type="submit" className="btn-secondary">Search</button>
        </form>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="input w-auto">
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data?.data.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects found" action={{ label: 'New Project', onClick: () => { setEditing(undefined); setModalOpen(true) } }} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Start</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to="/projects/$projectId" params={{ projectId: p.id }} className="font-medium text-gray-900 hover:text-brand-600">{p.name}</Link>
                      {p.city && <p className="text-xs text-gray-500">{p.city}{p.state ? `, ${p.state}` : ''}</p>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">{p.client?.name ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-700">{p.totalValueCents ? formatCents(p.totalValueCents) : '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{formatDate(p.startDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(p); setModalOpen(true) }} className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id) }} className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && <Pagination page={page} limit={20} total={data.meta.total} onPage={setPage} />}
        </div>
      )}

      <ProjectModal open={modalOpen} project={editing} onClose={() => { setModalOpen(false); setEditing(undefined) }} />
    </div>
  )
}
