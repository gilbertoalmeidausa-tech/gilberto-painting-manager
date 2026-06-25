import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, FileCheck, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiFetch } from '../../../lib/api'
import { formatDate } from '../../../lib/formatters'
import { Modal } from '../../../components/Modal'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { StatusBadge } from '../../../components/StatusBadge'
import { Spinner } from '../../../components/Spinner'

export const Route = createFileRoute('/_app/contracts/')({
  component: ContractsPage,
})

interface Contract {
  id: string; contractNumber: string; title: string; status: string; createdAt: string
  project: { id: string; name: string; client: { name: string } | null } | null
  proposal: { proposalNumber: string } | null
}

const newContractSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  projectId: z.string().uuid().optional().or(z.literal('')),
  proposalId: z.string().uuid().optional().or(z.literal('')),
})
type NewContractForm = z.infer<typeof newContractSchema>

function NewContractModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = Route.useNavigate()

  const { data: projectsData } = useQuery({
    queryKey: ['projects-mini'],
    queryFn: () => apiFetch<{ data: Array<{ id: string; name: string }> }>('/api/projects?limit=100'),
  })

  const { data: proposalsData } = useQuery({
    queryKey: ['proposals-mini'],
    queryFn: () => apiFetch<{ data: Array<{ id: string; proposalNumber: string; title: string }> }>('/api/proposals?limit=100'),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<NewContractForm>({
    resolver: zodResolver(newContractSchema),
  })

  async function onSubmit(data: NewContractForm) {
    const res = await apiFetch<{ data: { id: string } }>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        projectId: data.projectId || undefined,
        proposalId: data.proposalId || undefined,
        scopeOfWork: '',
        paymentTerms: '[]',
        termsAndConditions: '',
      }),
    })
    qc.invalidateQueries({ queryKey: ['contracts'] })
    onClose()
    reset()
    navigate({ to: '/contracts/$contractId', params: { contractId: res.data.id } })
  }

  return (
    <Modal open={open} onClose={onClose} title="New Contract">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Title *</label>
          <input {...register('title')} className="input" placeholder="Painting Contract – 123 Main St" />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <label className="label">Project (optional)</label>
          <select {...register('projectId')} className="input">
            <option value="">— None —</option>
            {projectsData?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From Proposal (optional)</label>
          <select {...register('proposalId')} className="input">
            <option value="">— None —</option>
            {proposalsData?.data.map((p) => <option key={p.id} value={p.id}>{p.proposalNumber} – {p.title}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Spinner size="sm" /> : 'Create Contract'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ContractsPage() {
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', page],
    queryFn: () => apiFetch<{ data: Contract[]; meta: { total: number } }>(`/api/contracts?page=${page}&limit=20`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/contracts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.meta.total ?? 0} total</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />New Contract
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data?.data.length === 0 ? (
        <EmptyState icon={FileCheck} title="No contracts yet" action={{ label: 'New Contract', onClick: () => setModalOpen(true) }} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Contract</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Project / Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to="/contracts/$contractId" params={{ contractId: c.id }} className="font-medium text-gray-900 hover:text-brand-600">
                        {c.contractNumber}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-48">{c.title}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.project ? (
                        <div>
                          <p className="text-gray-700">{c.project.name}</p>
                          {c.project.client && <p className="text-xs text-gray-500">{c.project.client.name}</p>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => { if (confirm('Delete this contract?')) deleteMutation.mutate(c.id) }}
                          disabled={c.status === 'signed'}
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

      <NewContractModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
