import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Receipt, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiFetch } from '../../../lib/api'
import { formatCents, formatDate } from '../../../lib/formatters'
import { Modal } from '../../../components/Modal'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { StatusBadge } from '../../../components/StatusBadge'
import { Spinner } from '../../../components/Spinner'

export const Route = createFileRoute('/_app/invoices/')({
  component: InvoicesPage,
})

interface Invoice {
  id: string; invoiceNumber: string; status: string
  totalCents: number; amountDueCents: number; dueDate: string | null; createdAt: string
  project: { id: string; name: string; client: { name: string } | null } | null
}

const newInvoiceSchema = z.object({
  projectId: z.string().uuid().optional().or(z.literal('')),
})
type NewInvoiceForm = z.infer<typeof newInvoiceSchema>

function NewInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const navigate = Route.useNavigate()

  const { data: projectsData } = useQuery({
    queryKey: ['projects-mini'],
    queryFn: () => apiFetch<{ data: Array<{ id: string; name: string }> }>('/api/projects?limit=100'),
  })

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<NewInvoiceForm>({
    resolver: zodResolver(newInvoiceSchema),
  })

  async function onSubmit(data: NewInvoiceForm) {
    const res = await apiFetch<{ data: { id: string } }>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify({ projectId: data.projectId || undefined }),
    })
    qc.invalidateQueries({ queryKey: ['invoices'] })
    onClose()
    reset()
    navigate({ to: '/invoices/$invoiceId', params: { invoiceId: res.data.id } })
  }

  return (
    <Modal open={open} onClose={onClose} title="New Invoice">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            {isSubmitting ? <Spinner size="sm" /> : 'Create Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const qc = useQueryClient()

  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (statusFilter) params.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter],
    queryFn: () => apiFetch<{ data: Invoice[]; meta: { total: number } }>(`/api/invoices?${params}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })

  const STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'voided']

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.meta.total ?? 0} total</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />New Invoice
        </button>
      </div>

      <div className="flex gap-2">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="input w-auto">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data?.data.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices found" action={{ label: 'New Invoice', onClick: () => setModalOpen(true) }} />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Invoice</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Project / Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Due</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to="/invoices/$invoiceId" params={{ invoiceId: inv.id }} className="font-medium text-gray-900 hover:text-brand-600">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {inv.project ? (
                        <div>
                          <p className="text-gray-700">{inv.project.name}</p>
                          {inv.project.client && <p className="text-xs text-gray-500">{inv.project.client.name}</p>}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCents(inv.totalCents)}</td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      {inv.amountDueCents > 0 && <span className="text-orange-600 font-medium">{formatCents(inv.amountDueCents)}</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => { if (confirm('Delete this invoice?')) deleteMutation.mutate(inv.id) }}
                          disabled={inv.status === 'paid'}
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

      <NewInvoiceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
