import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Download, CheckCircle, Send } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { apiFetch } from '../../../lib/api'
import { formatDate, formatDateInput, parseDateInput } from '../../../lib/formatters'
import { StatusBadge } from '../../../components/StatusBadge'
import { PageSpinner, Spinner } from '../../../components/Spinner'
import { ContractPdf } from '../../../lib/pdf/ContractPdf'
import { useLogo } from '../../../hooks/useLogo'

export const Route = createFileRoute('/_app/contracts/$contractId')({
  component: ContractDetailPage,
})

interface Contract {
  id: string; contractNumber: string; title: string; status: string
  scopeOfWork: string; paymentTerms: string; termsAndConditions: string
  signedByName: string | null; signedAt: string | null; createdAt: string
  project: { id: string; name: string; client: { id: string; name: string; address: string | null; city: string | null; state: string | null } | null } | null
  proposal: { proposalNumber: string } | null
}

const contractFormSchema = z.object({
  title: z.string().min(1),
  scopeOfWork: z.string(),
  termsAndConditions: z.string(),
  signedByName: z.string().optional(),
  signedAt: z.string().optional(),
})
type ContractForm = z.infer<typeof contractFormSchema>

function ContractDetailPage() {
  const { contractId } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)
  const logoUrl = useLogo()

  const { data, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => apiFetch<{ data: Contract }>(`/api/contracts/${contractId}`),
  })

  const contract = data?.data

  const { register, handleSubmit, reset, getValues, formState: { isSubmitting } } = useForm<ContractForm>({
    resolver: zodResolver(contractFormSchema),
  })

  useEffect(() => {
    if (!contract) return
    reset({
      title: contract.title,
      scopeOfWork: contract.scopeOfWork,
      termsAndConditions: contract.termsAndConditions,
      signedByName: contract.signedByName ?? '',
      signedAt: formatDateInput(contract.signedAt),
    })
  }, [contract])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<ContractForm> & { status?: string }) =>
      apiFetch(`/api/contracts/${contractId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...body,
          signedAt: parseDateInput(body.signedAt ?? ''),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading) return <PageSpinner />
  if (!contract) return <div className="p-6 text-gray-500">Contract not found.</div>

  const isEditable = contract.status !== 'signed' && contract.status !== 'voided'

  return (
    <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button type="button" onClick={() => navigate({ to: '/contracts' })} className="mt-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{contract.contractNumber}</h1>
              <StatusBadge status={contract.status} />
            </div>
            {contract.project && (
              <Link to="/projects/$projectId" params={{ projectId: contract.project.id }} className="text-sm text-brand-600 hover:underline mt-0.5 inline-block">
                {contract.project.name}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isEditable && (
              <button type="submit" disabled={isSubmitting} className="btn-secondary text-sm">
                {isSubmitting ? <Spinner size="sm" /> : saved ? '✓ Saved' : 'Save'}
              </button>
            )}
            <PDFDownloadLink
              document={<ContractPdf contract={contract} logoUrl={logoUrl ?? undefined} />}
              fileName={`${contract.contractNumber}.pdf`}
              className="btn-secondary text-sm"
            >
              <><Download className="h-4 w-4" />PDF</>
            </PDFDownloadLink>
            {contract.status === 'draft' && (
              <button type="button" onClick={() => saveMutation.mutate({ ...getValues(), status: 'sent' })} className="btn-primary text-sm">
                <Send className="h-4 w-4" />Send
              </button>
            )}
            {contract.status === 'sent' && (
              <button type="button" onClick={() => saveMutation.mutate({ ...getValues(), status: 'signed', signedAt: new Date().toISOString() })} className="btn-primary text-sm">
                <CheckCircle className="h-4 w-4" />Mark Signed
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="card p-5">
          <label className="label">Contract Title</label>
          <input {...register('title')} disabled={!isEditable} className="input" />
        </div>

        {/* Scope of Work */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Scope of Work</h2>
          <textarea
            {...register('scopeOfWork')}
            rows={8}
            disabled={!isEditable}
            placeholder="Describe the work to be performed..."
            className="input font-mono text-sm"
          />
        </div>

        {/* Terms & Conditions */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Terms & Conditions</h2>
          <textarea
            {...register('termsAndConditions')}
            rows={8}
            disabled={!isEditable}
            placeholder="Enter terms and conditions..."
            className="input font-mono text-sm"
          />
        </div>

        {/* Signature */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Signature</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Signed By</label>
              <input {...register('signedByName')} disabled={!isEditable} className="input" placeholder="Client full name" />
            </div>
            <div>
              <label className="label">Signed Date</label>
              <input {...register('signedAt')} type="date" disabled={!isEditable} className="input" />
            </div>
          </div>
          {contract.signedAt && (
            <p className="mt-2 text-sm text-green-600 font-medium">✓ Signed on {formatDate(contract.signedAt)}</p>
          )}
        </div>
      </div>
    </form>
  )
}
