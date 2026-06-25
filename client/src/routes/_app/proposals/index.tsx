import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, FileText, Trash2 } from 'lucide-react'
import { apiFetch } from '../../../lib/api'
import { formatCents, formatDate } from '../../../lib/formatters'
import { Modal } from '../../../components/Modal'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { StatusBadge } from '../../../components/StatusBadge'
import { Spinner } from '../../../components/Spinner'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

export const Route = createFileRoute('/_app/proposals/')({
  component: ProposalsPage,
})

interface Proposal {
  id: string; proposalNumber: string; title: string; status: string
  totalCents: number; createdAt: string
  project: { id: string; name: string; client: { name: string } | null } | null
}

const newProposalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  projectId: z.string().uuid().optional().or(z.literal('')),
})
type NewProposalForm = z.infer<typeof newProposalSchema>

function NewProposalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = Route.useNavigate()

  const { data: projectsData } = useQuery({
    queryKey: ['projects-mini'],
    queryFn: () => apiFetch<{ data: Array<{ id: string; name: string }> }>('/api/projects?limit=100'),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<NewProposalForm>({
    resolver: zodResolver(newProposalSchema),
  })

  async function onSubmit(data: NewProposalForm) {
    const res = await apiFetch<{ data: { id: string } }>('/api/proposals', {
      method: 'POST',
      body: JSON.stringify({ title: data.title, projectId: data.projectId || undefined }),
    })
    qc.invalidateQueries({ queryKey: ['proposals'] })
    onClose()
    reset()
    navigate({ to: '/proposals/$proposalId', params: { proposalId: res.data.id } })
  }

  return (
    <Modal open={open} onClose={onClose} title="New Proposal">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input {...register('title')} className="input" placeholder="Exterior Repaint Proposal" />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <label className="label">Project (optional)</label>
          <select {...register('projectId')} className="input">
            <option value="">— No project —</option>
            {projectsData?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Spinner size="sm" /> : 'Create Proposal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ProposalsPage() {
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['proposals', page],
    queryFn: () => apiFetch<{ data: Proposal[]; meta: { total: number } }>(`/api/proposals?page=${page}&limit=20`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/proposals/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proposals'] }),
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.meta.total ?? 0} total</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />New Proposal
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data?.data.length === 0 ? (
        <EmptyState icon={FileText} title="No proposals yet" action={{ label: 'New Proposal', onClick: () => setModalOpen(true) }} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Proposal</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Project / Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to="/proposals/$proposalId" params={{ proposalId: p.id }} className="font-medium text-gray-900 hover:text-brand-600">
                        {p.proposalNumber}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-48">{p.title}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {p.project ? (
                        <div>
                          <p className="text-gray-700">{p.project.name}</p>
                          {p.project.client && <p className="text-xs text-gray-500">{p.project.client.name}</p>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCents(p.totalCents)}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => { if (confirm('Delete this proposal?')) deleteMutation.mutate(p.id) }}
                          disabled={p.status === 'accepted'}
                          className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        ><Trash2 className="h-4 w-4" /></button>
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

      <NewProposalModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
