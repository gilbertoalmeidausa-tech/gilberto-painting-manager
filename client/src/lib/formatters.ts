export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '$0.00'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

export function formatDateInput(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toISOString().slice(0, 10)
}

export function parseDateInput(value: string): string | undefined {
  if (!value) return undefined
  return new Date(value).toISOString()
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function taxRateDisplay(rateCents: number): string {
  return `${(rateCents / 100).toFixed(2)}%`
}
