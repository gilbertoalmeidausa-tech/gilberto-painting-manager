import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Users, FolderKanban, Receipt, DollarSign } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { formatCents, formatDate } from '../../lib/formatters'
import { StatusBadge } from '../../components/StatusBadge'
import { PageSpinner } from '../../components/Spinner'
import { useLogo } from '../../hooks/useLogo'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardPage,
})

interface DashboardData {
  clientCount: number
  activeProjectCount: number
  outstandingInvoiceCount: number
  outstandingAmountCents: number
  recentProjects: Array<{ id: string; name: string; status: string; client: { name: string } | null; updatedAt: string }>
  recentInvoices: Array<{ id: string; invoiceNumber: string; status: string; totalCents: number; dueDate: string | null; project: { name: string; client: { name: string } | null } | null }>
}

function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [clients, projects, invoices] = await Promise.all([
        apiFetch<{ data: unknown[]; meta: { total: number } }>('/api/clients?limit=1'),
        apiFetch<{ data: Array<{ id: string; name: string; status: string; client: { name: string } | null; updatedAt: string }>; meta: { total: number } }>('/api/projects?limit=5'),
        apiFetch<{ data: Array<{ id: string; invoiceNumber: string; status: string; totalCents: number; dueDate: string | null; project: { name: string; client: { name: string } | null } | null }>; meta: { total: number } }>('/api/invoices?limit=5'),
      ])

      const activeProjectsRes = await apiFetch<{ meta: { total: number } }>('/api/projects?limit=1&status=active')
      const outstandingRes = await apiFetch<{ data: Array<{ totalCents: number }> }>('/api/invoices?limit=100&status=sent')
      const overdueRes = await apiFetch<{ data: Array<{ totalCents: number }> }>('/api/invoices?limit=100&status=overdue')

      const outstandingInvoices = [...outstandingRes.data, ...overdueRes.data]
      const outstandingAmount = outstandingInvoices.reduce((s, inv) => s + inv.totalCents, 0)

      return {
        clientCount: clients.meta.total,
        activeProjectCount: activeProjectsRes.meta.total,
        outstandingInvoiceCount: outstandingInvoices.length,
        outstandingAmountCents: outstandingAmount,
        recentProjects: projects.data,
        recentInvoices: invoices.data,
      } as DashboardData
    },
  })
}

function StatCard({ label, value, icon: Icon, sub, color }: {
  label: string; value: string; icon: React.ElementType; sub?: string; color: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { data, isLoading } = useDashboard()
  const logoUrl = useLogo()

  if (isLoading) return <PageSpinner />

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your painting business</p>
        </div>
        {logoUrl && (
          <img src={logoUrl} alt="Company logo" className="h-10 object-contain" />
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients" value={String(data?.clientCount ?? 0)} icon={Users} color="bg-blue-500" />
        <StatCard label="Active Projects" value={String(data?.activeProjectCount ?? 0)} icon={FolderKanban} color="bg-green-500" />
        <StatCard label="Outstanding" value={String(data?.outstandingInvoiceCount ?? 0)} icon={Receipt} sub="invoices" color="bg-orange-500" />
        <StatCard label="Amount Due" value={formatCents(data?.outstandingAmountCents ?? 0)} icon={DollarSign} color="bg-brand-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Projects</h2>
            <Link to="/projects" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.recentProjects.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No projects yet</p>
            )}
            {data?.recentProjects.map((p) => (
              <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.client?.name ?? 'No client'}</p>
                </div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
            <Link to="/invoices" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data?.recentInvoices.length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No invoices yet</p>
            )}
            {data?.recentInvoices.map((inv) => (
              <Link key={inv.id} to="/invoices/$invoiceId" params={{ invoiceId: inv.id }}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">
                    {inv.project?.client?.name ?? inv.project?.name ?? 'No project'}{inv.dueDate ? ` · Due ${formatDate(inv.dueDate)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-gray-900">{formatCents(inv.totalCents)}</span>
                  <StatusBadge status={inv.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
