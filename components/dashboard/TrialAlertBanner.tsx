'use client'

import { AlertTriangle, Sparkles } from 'lucide-react'
import { computeDaysRemaining } from './SubscriptionBadge'
import type { SubscriptionStatus } from '@/types/database.types'

interface TrialAlertBannerProps {
  status: SubscriptionStatus
  trialEndsAt?: string | null
  currentPeriodEndsAt?: string | null
  onOpenUpgrade: () => void
}

export function TrialAlertBanner({
  status,
  trialEndsAt,
  currentPeriodEndsAt,
  onOpenUpgrade,
}: TrialAlertBannerProps) {
  if (status === 'active') return null

  const daysRemaining = computeDaysRemaining(
    status,
    trialEndsAt,
    currentPeriodEndsAt
  )

  const isExpired =
    status === 'expired' || status === 'past_due' || status === 'canceled'
  const isTrialEndingSoon = status === 'trialing' && daysRemaining <= 3

  if (!isExpired && !isTrialEndingSoon) return null

  return (
    <div
      className={`border-b ${
        isExpired
          ? 'bg-rose-50 border-rose-200 text-rose-900'
          : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm">
          <AlertTriangle
            className={`w-4 h-4 shrink-0 mt-0.5 sm:mt-0 ${
              isExpired ? 'text-rose-600' : 'text-amber-600'
            }`}
          />
          <p className="font-medium leading-snug">
            {isExpired ? (
              <>
                Votre abonnement est arrivé à échéance. Activez votre compte Pro
                dès maintenant pour ne pas interrompre vos tournées de livraison.
              </>
            ) : (
              <>
                Il vous reste{' '}
                <strong>
                  {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
                </strong>{' '}
                d&apos;essai gratuit. Activez votre compte Pro dès maintenant
                pour ne pas interrompre vos tournées de livraison.
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenUpgrade}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition shrink-0 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Renouveler via T-Money / Moov</span>
        </button>
      </div>
    </div>
  )
}
