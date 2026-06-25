import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Download, Send, CheckCircle, XCircle } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { apiFetch } from '../../../lib/api'
import { formatCents, formatDate, formatDateInput, parseDateInput, taxRateDisplay } from '../../../lib/formatters'
import { StatusBadge } from '../../../components/StatusBadge'
import { PageSpinner, Spinner } from '../../../components/Spinner'
import { LineItemEditor } from '../../../components/LineItemEditor'
import { ProposalPdf } from '../../../lib/pdf/ProposalPdf'
import { useLogo } from '../../../hooks/useLogo'

export const Route = createFileRoute('/_app/proposals/$proposalId')({
  component: ProposalDetailPage,
})

interface Proposal {
  id: string; proposalNumber: string; title: string; status: string
  lineItems: string; subtotalCents: number; taxRateCents: number
  taxAmountCents: number; discountAmountCents: number; totalCents: number
  paymentTerms: string; notes: string | null; validUntil: string | null
  sentAt: string | null; acceptedAt: string | null; rejectedAt: string | null
  createdAt: string
  project: { id: string; name: string; client: { id: string; name: string; address: string | null; city: string | null; state: string | null } | null } | null
}

const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.coerce.number().min(0),
  unit: z.string().default(''),
  unitPriceCents: z.coerce.number().int().min(0),
  totalCents: z.coerce.number().int().min(0),
})

const proposalFormSchema = z.object({
  title: z.string().min(1),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']),
  lineItems: z.array(lineItemSchema),
  subtotalCents: z.coerce.number().int().min(0),
  taxRateCents: z.coerce.number().int().min(0),
  taxAmountCents: z.coerce.number().int().min(0),
  discountAmountCents: z.coerce.number().int().min(0),
  totalCents: z.coerce.number().int().min(0),
  paymentTerms: z.string(),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
})
type ProposalForm = z.infer<typeof proposalFormSchema>

function ProposalDetailPage() {
  const { proposalId } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [subtotal, setSubtotal] = useState(0)
  const [saved, setSaved] = useState(false)
  const logoUrl = useLogo()

  const { data, isLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: () => apiFetch<{ data: Proposal }>(`/api/proposals/${proposalId}`),
  })

  const proposal = data?.data

  const methods = useForm<ProposalForm>({
    resolver: zodResolver(proposalFormSchema),
  })

  useEffect(() => {
    if (!proposal) return
    const lineItems = JSON.parse(proposal.lineItems || '[]')
    methods.reset({
      title: proposal.title,
      status: proposal.status as ProposalForm['status'],
      lineItems,
      subtotalCents: proposal.subtotalCents,
      taxRateCents: proposal.taxRateCents,
      taxAmountCents: proposal.taxAmountCents,
      discountAmountCents: proposal.discountAmountCents,
      totalCents: proposal.totalCents,
      paymentTerms: proposal.paymentTerms,
      notes: proposal.notes ?? '',
      validUntil: formatDateInput(proposal.validUntil),
    })
    setSubtotal(proposal.subtotalCents)
  }, [proposal])

  const saveMutation = useMutation({
    mutationFn: (body: ProposalForm) => apiFetch(`/api/proposals/${proposalId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...body,
        validUntil: parseDateInput(body.validUntil ?? ''),
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposal', proposalId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function onSubtotalChange(sub: number) {
    setSubtotal(sub)
    const taxRate = methods.getValues('taxRateCents') ?? 0
    const discount = methods.getValues('discountAmountCents') ?? 0
    const tax = Math.round(sub * taxRate / 10000)
    methods.setValue('subtotalCents', sub)
    methods.setValue('taxAmountCents', tax)
    methods.setValue('totalCents', sub + tax - discount)
  }

  if (isLoading) return <PageSpinner />
  if (!proposal) return <div className="p-6 text-gray-500">Proposal not found.</div>

  const isEditable = proposal.status === 'draft'

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((data) => saveMutation.mutate(data))}>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => navigate({ to: '/proposals' })} className="mt-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{proposal.proposalNumber}</h1>
                <StatusBadge status={proposal.status} />
              </div>
              {proposal.project && (
                <Link to="/projects/$projectId" params={{ projectId: proposal.project.id }} className="text-sm text-brand-600 hover:underline mt-0.5 inline-block">
                  {proposal.project.name}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isEditable && (
                <button type="submit" disabled={saveMutation.isPending} className="btn-secondary text-sm">
                  {saveMutation.isPending ? <Spinner size="sm" /> : saved ? <CheckCircle className="h-4 w-4 text-green-500" /> : 'Save Draft'}
                </button>
              )}
              <PDFDownloadLink
                document={<ProposalPdf proposal={proposal} logoUrl={logoUrl ?? undefined} />}
                fileName={`${proposal.proposalNumber}.pdf`}
                className="btn-secondary text-sm"
              >
                <><Download className="h-4 w-4" />PDF</>
              </PDFDownloadLink>
              {proposal.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => saveMutation.mutate({ ...methods.getValues(), status: 'sent' })}
                  className="btn-primary text-sm"
                >
                  <Send className="h-4 w-4" />Mark Sent
                </button>
              )}
              {proposal.status === 'sent' && (
                <>
                  <button type="button" onClick={() => saveMutation.mutate({ ...methods.getValues(), status: 'accepted' })} className="btn-primary text-sm"><CheckCircle className="h-4 w-4" />Accept</button>
                  <button type="button" onClick={() => saveMutation.mutate({ ...methods.getValues(), status: 'rejected' })} className="btn-danger text-sm"><XCircle className="h-4 w-4" />Reject</button>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="card p-5 space-y-4">
            <div>
              <label className="label">Title</label>
              <input {...methods.register('title')} disabled={!isEditable} className="input" />
            </div>
            <div>
              <label className="label">Valid Until</label>
              <input {...methods.register('validUntil')} type="date" disabled={!isEditable} className="input max-w-xs" />
            </div>
          </div>

          {/* Line Items */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Line Items</h2>
            <LineItemEditor name="lineItems" onTotalsChange={onSubtotalChange} disabled={!isEditable} />

            <div className="mt-6 flex justify-end">
              <div className="space-y-2 min-w-56">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCents(subtotal)}</span>
                </div>
                {isEditable ? (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-500">Tax rate (%×100)</span>
                    <input
                      {...methods.register('taxRateCents', { valueAsNumber: true })}
                      type="number" min="0" max="5000"
                      className="input w-24 text-right"
                      onChange={(e) => {
                        methods.register('taxRateCents').onChange(e)
                        const tax = Math.round(subtotal * Number(e.target.value) / 10000)
                        const discount = methods.getValues('discountAmountCents') ?? 0
                        methods.setValue('taxAmountCents', tax)
                        methods.setValue('totalCents', subtotal + tax - discount)
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax ({taxRateDisplay(proposal.taxRateCents)})</span>
                    <span>{formatCents(proposal.taxAmountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  {isEditable ? (
                    <input
                      {...methods.register('discountAmountCents', { valueAsNumber: true })}
                      type="number" min="0"
                      className="input w-24 text-right"
                      onChange={(e) => {
                        methods.register('discountAmountCents').onChange(e)
                        const tax = methods.getValues('taxAmountCents') ?? 0
                        methods.setValue('totalCents', subtotal + tax - Number(e.target.value))
                      }}
                    />
                  ) : <span>{formatCents(proposal.discountAmountCents)}</span>}
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                  <span>Total</span>
                  <span>{formatCents(methods.watch('totalCents') ?? proposal.totalCents)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Notes</h2>
            <textarea
              {...methods.register('notes')}
              rows={4}
              disabled={!isEditable}
              className="input"
              placeholder="Additional notes, terms, or conditions..."
            />
          </div>

          {!isEditable && (
            <div className="text-xs text-gray-400 text-center">
              This proposal is {proposal.status} and cannot be edited.
              {proposal.acceptedAt && ` Accepted on ${formatDate(proposal.acceptedAt)}.`}
              {proposal.rejectedAt && ` Rejected on ${formatDate(proposal.rejectedAt)}.`}
            </div>
          )}
        </div>
      </form>
    </FormProvider>
  )
}
