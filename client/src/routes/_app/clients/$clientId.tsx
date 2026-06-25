import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Phone, Mail, MapPin, FolderKanban, Plus } from 'lucide-react'
import { apiFetch } from '../../../lib/api'
import { formatDate, formatPhone } from '../../../lib/formatters'
import { StatusBadge } from '../../../components/StatusBadge'
import { PageSpinner } from '../../../components/Spinner'
import { EmptyState } from '../../../components/EmptyState'

export const Route = createFileRoute('/_app/clients/$clientId')({
  component: ClientDetailPage,
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
  projects: Array<{ id: string; name: string; status: string; startDate: string | null; totalValueCents: number | null }>
}

function ClientDetailPage() {
  const { clientId } = Route.useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => apiFetch<{ data: Client }>(`/api/clients/${clientId}`),
  })

  if (isLoading) return <PageSpinner />
  const client = data?.data
  if (!client) return <div className="p-6 text-gray-500">Client not found.</div>

  const addressParts = [client.address, client.city, client.state, client.zip].filter(Boolean)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ to: '/clients' })} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Info card */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Contact Information</h2>
          {client.email && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
              <a href={`mailto:${client.email}`} className="hover:text-brand-600">{client.email}</a>
            </div>
          )}
          {client.phone && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
              <a href={`tel:${client.phone}`} className="hover:text-brand-600">{formatPhone(client.phone)}</a>
            </div>
          )}
          {addressParts.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
              <span>{addressParts.join(', ')}</span>
            </div>
          )}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">Client since {formatDate(client.createdAt)}</p>
          </div>
          {client.notes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="md:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Projects ({client.projects.length})</h2>
            <Link
              to="/projects"
              search={{ clientId } as never}
              className="btn-secondary text-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Project
            </Link>
          </div>
          {client.projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project for this client." />
          ) : (
            <div className="divide-y divide-gray-50">
              {client.projects.map((p) => (
                <Link
                  key={p.id}
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    {p.startDate && <p className="text-xs text-gray-500">{formatDate(p.startDate)}</p>}
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
