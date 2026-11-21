'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarPlus,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
} from 'lucide-react'
import { extendSubscription, toggleStoreStatus } from '@/app/actions/super-admin'
import type { SubscriptionStatus } from '@/types/database.types'

export interface SuperAdminStoreRow {
  id: string
  name: string
  createdAt: string
  ownerName: string
  ownerPhone: string | null
  ordersCount: number
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  monthlyPrice: number
}

type StatusFilter = 'all' | 'active' | 'trialing' | 'expired'

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getEffectiveState(store: SuperAdminStoreRow) {
  const now = Date.now()
  const trialEnd = store.trialEndsAt ? new Date(store.trialEndsAt).getTime() : 0
  const isTrialValid = store.status === 'trialing' && trialEnd >= now

  if (store.status === 'active') {
    return {
      key: 'active' as const,
      label: 'Actif',
      badgeClass: 'badge-status badge-delivered',
      dotClass: 'bg-[#22C55E]',
      dueDate: store.currentPeriodEndsAt ?? store.trialEndsAt,
    }
  }

  if (isTrialValid) {
    const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)))
    return {
      key: 'trialing' as const,
      label: `Essai (J-${daysLeft})`,
      badgeClass: 'badge-status badge-pending',
      dotClass: 'bg-[#F59E0B]',
      dueDate: store.trialEndsAt,
    }
  }

  return {
    key: 'expired' as const,
    label: 'Expiré',
    badgeClass: 'badge-status badge-discrepancy',
    dotClass: 'bg-[#EF4444]',
    dueDate: store.currentPeriodEndsAt ?? store.trialEndsAt,
  }
}

function buildWhatsAppUrl(store: SuperAdminStoreRow, stateKey: 'active' | 'trialing' | 'expired') {
  if (!store.ownerPhone) return null
  const digits = store.ownerPhone.replace(/\D/g, '')
  if (!digits) return null

  const normalized = digits.length === 8 ? `228${digits}` : digits
  const message =
    stateKey === 'active'
      ? `Bonjour ${store.ownerName}, nous confirmons la réception de votre paiement T-Money/Moov pour la boutique "${store.name}" sur Kaba Kaba. Votre abonnement est actif !`
      : `Bonjour ${store.ownerName}, l'abonnement de votre boutique "${store.name}" sur Kaba Kaba arrive à échéance. Vous pouvez renouveler via T-Money ou Moov pour conserver votre accès.`

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function StoresManagementTable({
  stores,
}: {
  stores: SuperAdminStoreRow[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stores.filter((store) => {
      const state = getEffectiveState(store)
      if (filter !== 'all' && state.key !== filter) return false
      if (!q) return true
      return (
        store.name.toLowerCase().includes(q) ||
        store.ownerName.toLowerCase().includes(q) ||
        (store.ownerPhone ?? '').toLowerCase().includes(q)
      )
    })
  }, [stores, search, filter])

  function handleExtend(store: SuperAdminStoreRow) {
    setPendingId(store.id)
    setFeedback(null)
    startTransition(async () => {
      const res = await extendSubscription(store.id, 30)
      setPendingId(null)
      if (!res.success) {
        setFeedback({
          type: 'error',
          text: res.error ?? 'Impossible de prolonger cet abonnement.',
        })
        return
      }
      setFeedback({
        type: 'success',
        text: `Abonnement de "${store.name}" prolongé de 30 jours.`,
      })
      router.refresh()
    })
  }

  function handleToggleStatus(
    store: SuperAdminStoreRow,
    nextStatus: SubscriptionStatus
  ) {
    setPendingId(store.id)
    setFeedback(null)
    startTransition(async () => {
      const res = await toggleStoreStatus(store.id, nextStatus)
      setPendingId(null)
      if (!res.success) {
        setFeedback({
          type: 'error',
          text: res.error ?? 'Impossible de modifier le statut.',
        })
        return
      }
      setFeedback({
        type: 'success',
        text:
          nextStatus === 'active'
            ? `Boutique "${store.name}" réactivée.`
            : `Boutique "${store.name}" suspendue.`,
      })
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Boutiques clientes ({filteredStores.length})
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Prolongez les abonnements après validation T-Money / Moov ou suspendez les comptes expirés.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher boutique, gérant..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all', label: 'Toutes' },
              { id: 'active', label: 'Actives' },
              { id: 'trialing', label: 'En essai' },
              { id: 'expired', label: 'Expirées' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {feedback && (
          <div
            className={`rounded-xl px-4 py-2.5 text-sm border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      {filteredStores.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          Aucune boutique ne correspond à votre recherche.
        </div>
      ) : (
        <>
          {/* Vue Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Boutique</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Statut Abonnement</th>
                  <th className="py-3.5 px-4">Échéance</th>
                  <th className="py-3.5 px-6 text-right">Actions rapides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStores.map((store) => {
                  const state = getEffectiveState(store)
                  const waUrl = buildWhatsAppUrl(store, state.key)
                  const isRowPending = isPending && pendingId === store.id
                  const isSuspended = state.key === 'expired'

                  return (
                    <tr key={store.id} className="hover:bg-slate-50/70">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900">
                          {store.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Créée le {formatDateFr(store.createdAt)} ·{' '}
                          {store.ordersCount} colis
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-800">
                          {store.ownerName}
                        </div>
                        {waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline mt-0.5"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            {store.ownerPhone}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Téléphone non renseigné
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className={state.badgeClass}>
                          <span className={`h-2 w-2 rounded-full ${state.dotClass}`} />
                          {state.label}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-[#0F172A] tabular-nums">
                        {formatDateFr(state.dueDate)}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isRowPending}
                            onClick={() => handleExtend(store)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 transition-colors"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            +30 jours
                          </button>

                          <button
                            type="button"
                            disabled={isRowPending}
                            onClick={() =>
                              handleToggleStatus(
                                store,
                                isSuspended ? 'active' : 'expired'
                              )
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50 transition-colors ${
                              isSuspended
                                ? 'bg-[#0B132B] text-white border-[#0B132B] hover:bg-[#131C31]'
                                : 'bg-white text-[#B91C1C] border-[#FECACA] hover:bg-[#FEF2F2]'
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <PlayCircle className="h-3.5 w-3.5" />
                                Réactiver
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-3.5 w-3.5" />
                                Suspendre
                              </>
                            )}
                          </button>

                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Envoyer un message WhatsApp"
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-[#0284C7]/25 bg-[#F0F9FF] text-[#0284C7] hover:bg-[#E0F2FE] transition-colors"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Vue Mobile */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredStores.map((store) => {
              const state = getEffectiveState(store)
              const waUrl = buildWhatsAppUrl(store, state.key)
              const isRowPending = isPending && pendingId === store.id
              const isSuspended = state.key === 'expired'

              return (
                <div key={store.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {store.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {store.ownerName} · {store.ordersCount} colis
                      </p>
                    </div>
                    <span className={`${state.badgeClass} shrink-0`}>
                      <span className={`h-2 w-2 rounded-full ${state.dotClass}`} />
                      {state.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>Créée : {formatDateFr(store.createdAt)}</span>
                    <span className="font-medium">
                      Échéance : {formatDateFr(state.dueDate)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isRowPending}
                      onClick={() => handleExtend(store)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      +30 jours
                    </button>

                    <button
                      type="button"
                      disabled={isRowPending}
                      onClick={() =>
                        handleToggleStatus(
                          store,
                          isSuspended ? 'active' : 'expired'
                        )
                      }
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border disabled:opacity-50 ${
                        isSuspended
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-rose-700 border-rose-200'
                      }`}
                    >
                      {isSuspended ? 'Réactiver' : 'Suspendre'}
                    </button>

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
