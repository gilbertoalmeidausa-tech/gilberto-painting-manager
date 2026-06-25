import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Users, Search, Pencil, Trash2, Phone, Mail } from 'lucide-react'
import { apiFetch } from '../../../lib/api'
import { formatDate, formatPhone } from '../../../lib/formatters'
import { Modal } from '../../../components/Modal'
import { EmptyState } from '../../../components/EmptyState'
import { Pagination } from '../../../components/Pagination'
import { Spinner } from '../../../components/Spinner'

export const Route = createFileRoute('/_app/clients/')({
  component: ClientsPage,
})

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  notes: string | null
  createdAt: string
}

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  notes: z.string().optional(),
})
type ClientForm = z.infer<typeof clientSchema>

function useClients(page: number, q: string) {
  return useQuery({
    queryKey: ['clients', page, q],
    queryFn: () => apiFetch<{ data: Client[]; meta: { page: number; limit: number; total: number } }>(
      `/api/clients?page=${page}&limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  })
}

function ClientModal({ client, open, onClose }: { client?: Client; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    values: client ? {
      name: client.name,
      email: client.email ?? '',
      phone: client.phone ?? '',
      address: client.address ?? '',
      city: client.city ?? '',
      state: client.state ?? '',
      zip: client.zip ?? '',
      notes: client.notes ?? '',
    } : undefined,
  })

  async function onSubmit(data: ClientForm) {
    const method = client ? 'PUT' : 'POST'
    const url = client ? `/api/clients/${client.id}` : '/api/clients'
    await apiFetch(url, { method, body: JSON.stringify(data) })
    qc.invalidateQueries({ queryKey: ['clients'] })
    onClose()
    reset()
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? 'Edit Client' : 'New Client'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Name *</label>
          <input {...register('name')} className="input" placeholder="John Smith" />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" className="input" placeholder="john@example.com" />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input {...register('phone')} className="input" placeholder="857-555-0123" />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input {...register('address')} className="input" placeholder="123 Main St" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="label">City</label>
            <input {...register('city')} className="input" placeholder="Boston" />
          </div>
          <div>
            <label className="label">State</label>
            <input {...register('state')} className="input" placeholder="MA" />
          </div>
          <div>
            <label className="label">ZIP</label>
            <input {...register('zip')} className="input" placeholder="02101" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea {...register('notes')} rows={3} className="input" placeholder="Optional notes..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Spinner size="sm" /> : client ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ClientsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Client | undefined>()
  const qc = useQueryClient()

  const { data, isLoading } = useClients(page, q)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setQ(search)
    setPage(1)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.meta.total ?? 0} total clients</p>
        </div>
        <button onClick={() => { setEditing(undefined); setModalOpen(true) }} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Client
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="input pl-9"
          />
        </div>
        <button type="submit" className="btn-secondary">Search</button>
        {q && <button type="button" onClick={() => { setSearch(''); setQ(''); setPage(1) }} className="btn-secondary">Clear</button>}
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to get started."
          action={{ label: 'New Client', onClick: () => { setEditing(undefined); setModalOpen(true) } }}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Contact</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to="/clients/$clientId" params={{ clientId: client.id }}
                        className="font-medium text-gray-900 hover:text-brand-600">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {client.email && <span className="flex items-center gap-1 text-gray-600"><Mail className="h-3 w-3" />{client.email}</span>}
                        {client.phone && <span className="flex items-center gap-1 text-gray-600"><Phone className="h-3 w-3" />{formatPhone(client.phone)}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                      {[client.city, client.state].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500">{formatDate(client.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditing(client); setModalOpen(true) }}
                          className="rounded p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete "${client.name}"?`)) deleteMutation.mutate(client.id) }}
                          className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
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

      <ClientModal
        client={editing}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined) }}
      />
    </div>
  )
}
