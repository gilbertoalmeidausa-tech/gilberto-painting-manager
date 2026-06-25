import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Download, CheckCircle, Send } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { apiFetch } from '../../../lib/api'
import { formatCents, formatDate, formatDateInput, parseDateInput, taxRateDisplay } from '../../../lib/formatters'
import { StatusBadge } from '../../../components/StatusBadge'
import { PageSpinner, Spinner } from '../../../components/Spinner'
import { LineItemEditor } from '../../../components/LineItemEditor'
import { InvoicePdf } from '../../../lib/pdf/InvoicePdf'
import { useLogo } from '../../../hooks/useLogo'

export const Route = createFileRoute('/_app/invoices/$invoiceId')({
  component: InvoiceDetailPage,
})

interface Invoice {
  id: string; invoiceNumber: string; status: string
  lineItems: string; subtotalCents: number; taxRateCents: number
  taxAmountCents: number; discountAmountCents: number; totalCents: number
  amountPaidCents: number; amountDueCents: number
  dueDate: string | null; paidAt: string | null; notes: string | null; createdAt: string
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

const invoiceFormSchema = z.object({
  lineItems: z.array(lineItemSchema),
  subtotalCents: z.coerce.number().int().min(0),
  taxRateCents: z.coerce.number().int().min(0),
  taxAmountCents: z.coerce.number().int().min(0),
  discountAmountCents: z.coerce.number().int().min(0),
  totalCents: z.coerce.number().int().min(0),
  amountPaidCents: z.coerce.number().int().min(0),
  amountDueCents: z.coerce.number().int().min(0),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})
type InvoiceForm = z.infer<typeof invoiceFormSchema>

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [subtotal, setSubtotal] = useState(0)
  const logoUrl = useLogo()
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => apiFetch<{ data: Invoice }>(`/api/invoices/${invoiceId}`),
  })

  const invoice = data?.data

  const methods = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceFormSchema),
  })

  useEffect(() => {
    if (!invoice) return
    const lineItems = JSON.parse(invoice.lineItems || '[]')
    methods.reset({
      lineItems,
      subtotalCents: invoice.subtotalCents,
      taxRateCents: invoice.taxRateCents,
      taxAmountCents: invoice.taxAmountCents,
      discountAmountCents: invoice.discountAmountCents,
      totalCents: invoice.totalCents,
      amountPaidCents: invoice.amountPaidCents,
      amountDueCents: invoice.amountDueCents,
      dueDate: formatDateInput(invoice.dueDate),
      notes: invoice.notes ?? '',
    })
    setSubtotal(invoice.subtotalCents)
  }, [invoice])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<InvoiceForm> & { status?: string; paidAt?: string }) =>
      apiFetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...body,
          dueDate: parseDateInput(body.dueDate ?? ''),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function onSubtotalChange(sub: number) {
    setSubtotal(sub)
    const taxRate = methods.getValues('taxRateCents') ?? 0
    const discount = methods.getValues('discountAmountCents') ?? 0
    const paid = methods.getValues('amountPaidCents') ?? 0
    const tax = Math.round(sub * taxRate / 10000)
    const total = sub + tax - discount
    methods.setValue('subtotalCents', sub)
    methods.setValue('taxAmountCents', tax)
    methods.setValue('totalCents', total)
    methods.setValue('amountDueCents', Math.max(0, total - paid))
  }

  if (isLoading) return <PageSpinner />
  if (!invoice) return <div className="p-6 text-gray-500">Invoice not found.</div>

  const isEditable = invoice.status !== 'paid' && invoice.status !== 'voided'

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((data) => saveMutation.mutate(data))}>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => navigate({ to: '/invoices' })} className="mt-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
                <StatusBadge status={invoice.status} />
              </div>
              {invoice.project && (
                <Link to="/projects/$projectId" params={{ projectId: invoice.project.id }} className="text-sm text-brand-600 hover:underline mt-0.5 inline-block">
                  {invoice.project.name}{invoice.project.client ? ` · ${invoice.project.client.name}` : ''}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {isEditable && (
                <button type="submit" disabled={saveMutation.isPending} className="btn-secondary text-sm">
                  {saveMutation.isPending ? <Spinner size="sm" /> : saved ? '✓ Saved' : 'Save'}
                </button>
              )}
              <PDFDownloadLink
                document={<InvoicePdf invoice={invoice} logoUrl={logoUrl ?? undefined} />}
                fileName={`${invoice.invoiceNumber}.pdf`}
                className="btn-secondary text-sm"
              >
                <><Download className="h-4 w-4" />PDF</>
              </PDFDownloadLink>
              {invoice.status === 'draft' && (
                <button type="button" onClick={() => saveMutation.mutate({ ...methods.getValues(), status: 'sent' })} className="btn-primary text-sm">
                  <Send className="h-4 w-4" />Send
                </button>
              )}
              {(invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue') && (
                <button type="button" onClick={() => saveMutation.mutate({ ...methods.getValues(), status: 'paid', paidAt: new Date().toISOString() })} className="btn-primary text-sm">
                  <CheckCircle className="h-4 w-4" />Mark Paid
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCents(methods.watch('totalCents') ?? invoice.totalCents)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Amount Paid</p>
              <p className="text-xl font-bold text-green-600 mt-0.5">{formatCents(invoice.amountPaidCents)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Amount Due</p>
              <p className="text-xl font-bold text-orange-600 mt-0.5">{formatCents(invoice.amountDueCents)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500">Due Date</p>
              <p className="text-base font-semibold text-gray-900 mt-0.5">{formatDate(invoice.dueDate)}</p>
            </div>
          </div>

          {/* Due Date */}
          <div className="card p-5">
            <label className="label">Due Date</label>
            <input {...methods.register('dueDate')} type="date" disabled={!isEditable} className="input max-w-xs" />
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax ({taxRateDisplay(invoice.taxRateCents)})</span>
                  <span>{formatCents(methods.watch('taxAmountCents') ?? invoice.taxAmountCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span>-{formatCents(methods.watch('discountAmountCents') ?? invoice.discountAmountCents)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                  <span>Total</span>
                  <span>{formatCents(methods.watch('totalCents') ?? invoice.totalCents)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Notes</h2>
            <textarea {...methods.register('notes')} rows={3} disabled={!isEditable} className="input" placeholder="Payment instructions, notes..." />
          </div>

          {invoice.paidAt && (
            <p className="text-sm text-green-600 text-center font-medium">✓ Paid on {formatDate(invoice.paidAt)}</p>
          )}
        </div>
      </form>
    </FormProvider>
  )
}
