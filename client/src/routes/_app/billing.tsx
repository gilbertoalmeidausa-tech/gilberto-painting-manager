import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CreditCard, CheckCircle, ExternalLink } from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { formatDate } from '../../lib/formatters'
import { PageSpinner, Spinner } from '../../components/Spinner'
import { useAuth } from '../../hooks/useAuth'
import { StatusBadge } from '../../components/StatusBadge'

export const Route = createFileRoute('/_app/billing')({
  component: BillingPage,
})

interface Plan {
  id: string; name: string; description: string
  priceMonthlyCents: number; priceYearlyCents: number
  maxClients: number | null; maxProjects: number | null
  maxMembers: number | null; maxStorageMb: number
  features: string[]
}

interface Subscription {
  plan: string; planStatus: string; billingCycle: string
  trialEndsAt: string | null; currentPeriodEndsAt: string | null
  stripeSubscriptionId: string | null
}

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(0)}/mo`
}

function BillingPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiFetch<{ data: Plan[] }>('/api/billing/plans'),
  })

  const { data: subData, isLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiFetch<{ data: Subscription }>('/api/billing/subscription'),
  })

  const checkoutMutation = useMutation({
    mutationFn: ({ plan, cycle }: { plan: string; cycle: string }) =>
      apiFetch<{ data: { url: string } }>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan, cycle }) }),
    onSuccess: (data) => {
      if (data.data.url) window.location.href = data.data.url
    },
  })

  const portalMutation = useMutation({
    mutationFn: () => apiFetch<{ data: { url: string } }>('/api/billing/portal', { method: 'POST' }),
    onSuccess: (data) => {
      if (data.data.url) window.location.href = data.data.url
    },
  })

  if (isLoading) return <PageSpinner />

  const subscription = subData?.data
  const plans = plansData?.data ?? []
  const currentPlan = subscription?.plan ?? 'free_trial'

  // Check for success/cancel URL params
  const successParam = new URLSearchParams(window.location.search).get('success')
  const canceledParam = new URLSearchParams(window.location.search).get('canceled')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription and billing</p>
      </div>

      {successParam && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-5 py-4 flex items-center gap-3 text-green-700">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>Subscription activated! Thank you.</span>
        </div>
      )}
      {canceledParam && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-5 py-4 text-gray-600">
          Checkout was canceled. Your plan has not changed.
        </div>
      )}

      {/* Current Plan */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Current Plan</h2>
            <div className="flex items-center gap-2">
              <StatusBadge status={currentPlan} />
              {subscription?.planStatus && <StatusBadge status={subscription.planStatus} />}
            </div>
            {subscription?.trialEndsAt && subscription.planStatus === 'trialing' && (
              <p className="text-sm text-gray-500 mt-2">Trial ends {formatDate(subscription.trialEndsAt)}</p>
            )}
            {subscription?.currentPeriodEndsAt && subscription.planStatus === 'active' && (
              <p className="text-sm text-gray-500 mt-2">Next renewal {formatDate(subscription.currentPeriodEndsAt)}</p>
            )}
          </div>
          <CreditCard className="h-8 w-8 text-gray-300" />
        </div>
        {isOwner && subscription?.stripeSubscriptionId && (
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="btn-secondary mt-4 text-sm"
          >
            {portalMutation.isPending ? <Spinner size="sm" /> : <><ExternalLink className="h-4 w-4" />Manage Billing</>}
          </button>
        )}
      </div>

      {/* Plans */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Plans</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {plans.filter(p => p.id !== 'free_trial').map((plan) => {
            const isCurrentPlan = plan.id === currentPlan
            return (
              <div key={plan.id} className={`card p-6 space-y-4 ${isCurrentPlan ? 'ring-2 ring-brand-500' : ''}`}>
                {isCurrentPlan && (
                  <span className="badge bg-brand-100 text-brand-700">Current Plan</span>
                )}
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{plan.name}</h3>
                  <p className="text-gray-500 text-sm">{plan.description}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatPrice(plan.priceMonthlyCents)}</p>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    {plan.maxClients === null ? 'Unlimited clients' : `${plan.maxClients} clients`}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    {plan.maxMembers === null ? 'Unlimited team members' : `${plan.maxMembers} team member${plan.maxMembers === 1 ? '' : 's'}`}
                  </li>
                </ul>
                {isOwner && !isCurrentPlan && (
                  <button
                    onClick={() => checkoutMutation.mutate({ plan: plan.id, cycle: 'monthly' })}
                    disabled={checkoutMutation.isPending}
                    className="btn-primary w-full justify-center"
                  >
                    {checkoutMutation.isPending ? <Spinner size="sm" /> : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
