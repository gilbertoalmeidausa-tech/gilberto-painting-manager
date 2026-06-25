import { cn } from '../lib/cn'

type Status =
  | 'lead' | 'active' | 'on_hold' | 'completed' | 'cancelled'
  | 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  | 'signed' | 'voided'
  | 'partial' | 'paid' | 'overdue'
  | 'trialing' | 'past_due' | 'canceled' | 'paused'
  | string

const STATUS_STYLES: Record<string, string> = {
  // Projects
  lead:       'bg-gray-100 text-gray-700',
  active:     'bg-green-100 text-green-700',
  on_hold:    'bg-yellow-100 text-yellow-700',
  completed:  'bg-blue-100 text-blue-700',
  cancelled:  'bg-red-100 text-red-700',
  // Proposals / Contracts
  draft:      'bg-gray-100 text-gray-700',
  sent:       'bg-blue-100 text-blue-700',
  accepted:   'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-700',
  expired:    'bg-orange-100 text-orange-700',
  signed:     'bg-green-100 text-green-700',
  voided:     'bg-red-100 text-red-600',
  // Invoices
  partial:    'bg-yellow-100 text-yellow-700',
  paid:       'bg-green-100 text-green-700',
  overdue:    'bg-red-100 text-red-700',
  // Plans
  trialing:   'bg-brand-100 text-brand-700',
  past_due:   'bg-red-100 text-red-700',
  canceled:   'bg-gray-100 text-gray-600',
  paused:     'bg-yellow-100 text-yellow-700',
}

const STATUS_LABELS: Record<string, string> = {
  on_hold: 'On Hold',
  free_trial: 'Free Trial',
  past_due: 'Past Due',
}

interface StatusBadgeProps {
  status: Status
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
  const label = STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={cn('badge', style, className)}>{label}</span>
  )
}
