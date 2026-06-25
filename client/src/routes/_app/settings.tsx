import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiFetch } from '../../lib/api'
import { PageSpinner, Spinner } from '../../components/Spinner'

export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

interface OrgSettings {
  id: string
  companyName: string; phone: string; email: string; website: string
  address: string; city: string; state: string; zip: string
  defaultTaxRateCents: number
  defaultPaymentTerms: string; defaultTermsAndConditions: string
  invoicePrefix: string; proposalPrefix: string; contractPrefix: string
  logoPath: string | null
}

const settingsSchema = z.object({
  companyName: z.string().max(150),
  phone: z.string().max(30),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().max(255),
  address: z.string().max(255),
  city: z.string().max(100),
  state: z.string().max(100),
  zip: z.string().max(20),
  defaultTaxRateCents: z.coerce.number().int().min(0).max(10000),
  defaultTermsAndConditions: z.string(),
  invoicePrefix: z.string().max(10),
  proposalPrefix: z.string().max(10),
  contractPrefix: z.string().max(10),
})
type SettingsForm = z.infer<typeof settingsSchema>

function LogoSection({ logoPath, qc }: { logoPath: string | null; qc: ReturnType<typeof useQueryClient> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentLogoUrl = logoPath ? `/api/public/logo/${logoPath}` : null
  const displayUrl = preview ?? currentLogoUrl

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setError(null)
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await apiFetch('/api/settings/logo', { method: 'POST', body: fd })
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      await qc.invalidateQueries({ queryKey: ['settings'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await apiFetch('/api/settings/logo', { method: 'DELETE' })
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      await qc.invalidateQueries({ queryKey: ['settings'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-semibold text-gray-900">Company Logo</h2>

      {/* Preview */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
          {displayUrl ? (
            <img src={displayUrl} alt="Company logo" className="h-full w-full object-contain p-1" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-brand-500">
              <span className="text-white text-xl font-bold">G</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.svg,image/png,image/jpeg,image/gif,image/svg+xml"
            onChange={handleFileChange}
            className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="text-xs text-gray-400">PNG, JPG, GIF, SVG · Max 5 MB · SVG will not appear in PDF exports.</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !preview}
          className="btn-primary"
        >
          {uploading ? <Spinner size="sm" /> : 'Upload Logo'}
        </button>
        {currentLogoUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {removing ? <Spinner size="sm" /> : 'Remove Logo'}
          </button>
        )}
      </div>
    </div>
  )
}

function SettingsPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<{ data: OrgSettings }>('/api/settings'),
  })

  const settings = data?.data

  const { register, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  })

  useEffect(() => {
    if (!settings) return
    reset({
      companyName: settings.companyName,
      phone: settings.phone,
      email: settings.email,
      website: settings.website,
      address: settings.address,
      city: settings.city,
      state: settings.state,
      zip: settings.zip,
      defaultTaxRateCents: settings.defaultTaxRateCents,
      defaultTermsAndConditions: settings.defaultTermsAndConditions,
      invoicePrefix: settings.invoicePrefix,
      proposalPrefix: settings.proposalPrefix,
      contractPrefix: settings.contractPrefix,
    })
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (body: SettingsForm) => apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  if (isLoading) return <PageSpinner />

  return (
    <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Company information and defaults</p>
          </div>
          <button type="submit" disabled={isSubmitting || !isDirty} className="btn-primary">
            {isSubmitting ? <Spinner size="sm" /> : 'Save Changes'}
          </button>
        </div>

        {saveMutation.isSuccess && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Settings saved successfully.
          </div>
        )}

        {/* Company Logo */}
        <LogoSection logoPath={settings?.logoPath ?? null} qc={qc} />

        {/* Company Info */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Company Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company Name</label>
              <input {...register('companyName')} className="input" placeholder="Gilberto Pro Painting" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input {...register('phone')} className="input" placeholder="857-505-6448" />
            </div>
            <div>
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" placeholder="info@example.com" />
            </div>
            <div className="col-span-2">
              <label className="label">Website</label>
              <input {...register('website')} className="input" placeholder="https://gilbertopropainting.com" />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input {...register('address')} className="input" placeholder="123 Main St" />
            </div>
            <div>
              <label className="label">City</label>
              <input {...register('city')} className="input" placeholder="Boston" />
            </div>
            <div>
              <label className="label">State</label>
              <input {...register('state')} className="input" placeholder="MA" />
            </div>
          </div>
        </div>

        {/* Defaults */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Invoice & Document Defaults</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Invoice Prefix</label>
              <input {...register('invoicePrefix')} className="input" placeholder="INV" />
            </div>
            <div>
              <label className="label">Proposal Prefix</label>
              <input {...register('proposalPrefix')} className="input" placeholder="P" />
            </div>
            <div>
              <label className="label">Contract Prefix</label>
              <input {...register('contractPrefix')} className="input" placeholder="C" />
            </div>
          </div>
          <div>
            <label className="label">Default Tax Rate (basis points, e.g. 800 = 8.00%)</label>
            <input {...register('defaultTaxRateCents')} type="number" min="0" max="10000" className="input max-w-32" />
          </div>
        </div>

        {/* Terms */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Default Terms & Conditions</h2>
          <textarea
            {...register('defaultTermsAndConditions')}
            rows={8}
            className="input font-mono text-sm"
            placeholder="Enter your standard terms and conditions..."
          />
        </div>
      </div>
    </form>
  )
}
