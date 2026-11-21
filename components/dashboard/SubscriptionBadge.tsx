'use client'

import { AlertTriangle, Clock, Sparkles } from 'lucide-react'
import type { SubscriptionStatus } from '@/types/database.types'

interface SubscriptionBadgeProps {
  status: SubscriptionStatus
  trialEndsAt?: string | null
  currentPeriodEndsAt?: string | null
  onClick: () => void
}

export function computeDaysRemaining(
  status: SubscriptionStatus,
  trialEndsAt?: string | null,
  currentPeriodEndsAt?: string | null
): number {
  const target = status === 'trialing' ? trialEndsAt : currentPeriodEndsAt
  if (!target) return 0
  const diffMs = new Date(target).getTime() - Date.now()
  if (Number.isNaN(diffMs) || diffMs <= 0) return 0
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function SubscriptionBadge({
  status,
  trialEndsAt,
  currentPeriodEndsAt,
  onClick,
}: SubscriptionBadgeProps) {
  const daysRemaining = computeDaysRemaining(
    status,
    trialEndsAt,
    currentPeriodEndsAt
  )

  if (status === 'active') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer shrink-0"
        title="Voir les détails de la Formule Pro"
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
        <span>✦ Formule Pro</span>
      </button>
    )
  }

  if (status === 'trialing') {
    const isUrgent = daysRemaining <= 3
    if (isUrgent) {
      return (
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100 transition cursor-pointer animate-pulse shrink-0"
          title="Votre essai se termine bientôt — cliquez pour activer Pro"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
          <span>⚠️ Essai • {daysRemaining}j restants</span>
        </button>
      )
    }

    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition cursor-pointer shrink-0"
        title="Période d'essai gratuit — cliquez pour passer en Pro"
      >
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        <span>Essai • {daysRemaining}j restants</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer shrink-0"
      title="Abonnement échu — cliquez pour renouveler"
    >
      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
      <span>Abonnement échu</span>
    </button>
  )
}
