import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, FileCheck, Receipt, Camera, Plus } from 'lucide-react'
import { apiFetch } from '../../../lib/api'
import { formatCents, formatDate } from '../../../lib/formatters'
import { StatusBadge } from '../../../components/StatusBadge'
import { PageSpinner } from '../../../components/Spinner'

export const Route = createFileRoute('/_app/projects/$projectId')({
  component: ProjectDetailPage,
})

interface ProjectDetail {
  id: string; name: string; status: string; description: string | null
  address: string | null; city: string | null; state: string | null; zip: string | null
  startDate: string | null; endDate: string | null; totalValueCents: number | null
  notes: string | null; createdAt: string
  client: { id: string; name: string } | null
  proposals: Array<{ id: string; proposalNumber: string; title: string; status: string; totalCents: number; createdAt: string }>
  contracts: Array<{ id: string; contractNumber: string; title: string; status: string; createdAt: string }>
  invoices: Array<{ id: string; invoiceNumber: string; status: string; totalCents: number; amountDueCents: number; dueDate: string | null }>
  photos: Array<{ id: string; filePath: string; phase: string; caption: string | null }>
}

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiFetch<{ data: ProjectDetail }>(`/api/projects/${projectId}`),
  })

  if (isLoading) return <PageSpinner />
  const project = data?.data
  if (!project) return <div className="p-6 text-gray-500">Project not found.</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate({ to: '/projects' })} className="mt-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          {project.client && (
            <Link to="/clients/$clientId" params={{ clientId: project.client.id }} className="text-sm text-brand-600 hover:underline mt-0.5 inline-block">
              {project.client.name}
            </Link>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid md:grid-cols-4 gap-4">
        {project.totalValueCents && (
          <div className="card p-4">
            <p className="text-xs text-gray-500">Contract Value</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCents(project.totalValueCents)}</p>
          </div>
        )}
        {project.startDate && (
          <div className="card p-4">
            <p className="text-xs text-gray-500">Start Date</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">{formatDate(project.startDate)}</p>
          </div>
        )}
        {project.endDate && (
          <div className="card p-4">
            <p className="text-xs text-gray-500">End Date</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">{formatDate(project.endDate)}</p>
          </div>
        )}
        {(project.city || project.state) && (
          <div className="card p-4">
            <p className="text-xs text-gray-500">Location</p>
            <p className="text-base font-semibold text-gray-900 mt-0.5">{[project.address, project.city, project.state].filter(Boolean).join(', ')}</p>
          </div>
        )}
      </div>

      {project.description && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.description}</p>
        </div>
      )}

      {/* Tabs sections */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Proposals */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="h-4 w-4" /> Proposals ({project.proposals.length})</h2>
            <Link to="/proposals" search={{ projectId } as never} className="btn-secondary text-xs py-1 px-2"><Plus className="h-3 w-3" /> New</Link>
          </div>
          {project.proposals.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No proposals yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {project.proposals.map((p) => (
                <Link key={p.id} to="/proposals/$proposalId" params={{ proposalId: p.id }}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.proposalNumber} · {p.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatCents(p.totalCents)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Contracts */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileCheck className="h-4 w-4" /> Contracts ({project.contracts.length})</h2>
            <Link to="/contracts" search={{ projectId } as never} className="btn-secondary text-xs py-1 px-2"><Plus className="h-3 w-3" /> New</Link>
          </div>
          {project.contracts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No contracts yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {project.contracts.map((c) => (
                <Link key={c.id} to="/contracts/$contractId" params={{ contractId: c.id }}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.contractNumber} · {c.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(c.createdAt)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Receipt className="h-4 w-4" /> Invoices ({project.invoices.length})</h2>
            <Link to="/invoices" search={{ projectId } as never} className="btn-secondary text-xs py-1 px-2"><Plus className="h-3 w-3" /> New</Link>
          </div>
          {project.invoices.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No invoices yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {project.invoices.map((inv) => (
                <Link key={inv.id} to="/invoices/$invoiceId" params={{ invoiceId: inv.id }}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                    {inv.dueDate && <p className="text-xs text-gray-500">Due {formatDate(inv.dueDate)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatCents(inv.totalCents)}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Photos */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Camera className="h-4 w-4" /> Photos ({project.photos.length})</h2>
            <Link to="/photos" search={{ projectId } as never} className="btn-secondary text-xs py-1 px-2"><Plus className="h-3 w-3" /> Upload</Link>
          </div>
          {project.photos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No photos yet</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 p-4">
              {project.photos.slice(0, 6).map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg bg-gray-100 overflow-hidden">
                  <img
                    src={`/api/photos/file/${photo.filePath}`}
                    alt={photo.caption ?? 'Project photo'}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {project.photos.length > 6 && (
                <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-500 font-medium">
                  +{project.photos.length - 6}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
