'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CalendarPlus,
  Eye,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Search,
  ShoppingBag,
  Store,
  Wallet,
  X,
} from 'lucide-react'
import { extendSubscription, toggleStoreStatus } from '@/app/actions/super-admin'
import { ServerPagination } from '@/components/ui/ServerPagination'
import type { SubscriptionStatus } from '@/types/database.types'

export interface StorePreviewOrderItem {
  id: string
  numberLabel: string
  amountFcfa: number
  status: string
  orderedAt: string
}

export interface SuperAdminStoreRow {
  id: string
  name: string
  createdAt: string
  ownerName: string
  ownerPhone: string | null
  city?: string | null
  ordersCount: number
  freeOrdersLimit?: number
  status: SubscriptionStatus
  planCode?: 'free_mvp' | 'pro' | 'business'
  planLabel?: string
  trialEndsAt: string | null
  currentPeriodEndsAt: string | null
  monthlyPrice: number
  totalRevenueFcfa?: number
  deliveredOrdersCount?: number
  pendingOrdersCount?: number
  recentOrders?: StorePreviewOrderItem[]
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

function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} F`
}

function getEffectiveState(store: SuperAdminStoreRow) {
  const now = Date.now()
  const trialEnd = store.trialEndsAt ? new Date(store.trialEndsAt).getTime() : 0
  const isTrialValid =
    store.status === 'trialing' && (!store.trialEndsAt || trialEnd >= now)

  const price = store.monthlyPrice || 5000
  const planName =
    store.planCode === 'business' || price >= 25000
      ? `Plan Business ${formatFcfa(25000)}/m`
      : price === 15000
        ? `Plan Trimestriel ${formatFcfa(15000)}/3m`
        : `Plan Solo ${formatFcfa(5000)}/m`

  if (store.status === 'active') {
    return {
      key: 'active' as const,
      label: store.planLabel || `Actif — ${planName}`,
      badgeClass:
        'inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-800',
      dotClass: 'bg-emerald-500',
      dueDate: store.currentPeriodEndsAt ?? store.trialEndsAt,
    }
  }

  if (isTrialValid) {
    return {
      key: 'trialing' as const,
      label: store.planLabel || 'Essai — Plan Gratuit (0 F)',
      badgeClass:
        'inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-extrabold text-amber-800',
      dotClass: 'bg-amber-500',
      dueDate: store.trialEndsAt,
    }
  }

  return {
    key: 'expired' as const,
    label: store.planLabel || `Suspendu — ${planName}`,
    badgeClass:
      'inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-extrabold text-rose-800',
    dotClass: 'bg-rose-500',
    dueDate: store.currentPeriodEndsAt ?? store.trialEndsAt,
  }
}

function buildWhatsAppUrl(
  store: SuperAdminStoreRow,
  stateKey: 'active' | 'trialing' | 'expired'
) {
  const digits = (store.ownerPhone || '').replace(/\D/g, '')
  const normalized =
    digits.length === 8
      ? `228${digits}`
      : digits.startsWith('00228')
        ? digits.slice(2)
        : digits

  const message =
    stateKey === 'active'
      ? `Bonjour ${store.ownerName}, nous confirmons que l'abonnement de votre boutique "${store.name}" sur Kaba Kaba est bien actif. Bonne vente !`
      : `Bonjour ${store.ownerName}, votre boutique "${store.name}" sur Kaba Kaba a atteint ${store.ordersCount}/${store.freeOrdersLimit || 20} commandes. Vous pouvez activer le Plan Solo (5 000 F/mois) par T-Money ou Flooz.`

  return normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`
}

function translateOrderStatus(status: string): {
  label: string
  className: string
} {
  switch (status) {
    case 'delivered':
      return {
        label: 'Livrée',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    case 'cancelled':
      return {
        label: 'Annulée',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      }
    case 'shipped':
    case 'assigned':
      return {
        label: 'En livraison',
        className: 'bg-sky-50 text-sky-700 border-sky-200',
      }
    case 'packed':
      return {
        label: 'Emballée',
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      }
    default:
      return {
        label: 'En cours',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      }
  }
}

export function StoresManagementTable({
  stores,
  currentPage = 1,
  totalCount,
  pageSize = 20,
  basePath = '/admin',
}: {
  stores: SuperAdminStoreRow[]
  currentPage?: number
  totalCount?: number
  pageSize?: number
  basePath?: string
  lang?: 'fr' | 'en'
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [previewStore, setPreviewStore] = useState<SuperAdminStoreRow | null>(
    null
  )
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
            <h2 className="text-lg font-extrabold text-slate-900">
              Boutiques clientes ({filteredStores.length})
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Suivez la consommation des 20 commandes gratuites, prolongez les
              forfaits ou contactez les vendeurs sur WhatsApp.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher boutique, gérant, tél..."
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
              { id: 'expired', label: 'Suspendues / Expirées' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
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
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold border ${
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
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Boutique &amp; Gérant</th>
                  <th className="py-3.5 px-4">Forfait &amp; Tarif</th>
                  <th className="py-3.5 px-4">Jauge Commandes</th>
                  <th className="py-3.5 px-4">Échéance</th>
                  <th className="py-3.5 px-5 text-right">Actions rapides</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStores.map((store) => {
                  const state = getEffectiveState(store)
                  const waUrl = buildWhatsAppUrl(store, state.key)
                  const isRowPending = isPending && pendingId === store.id
                  const isSuspended = state.key === 'expired'

                  const limit = store.freeOrdersLimit || 20
                  const pct = Math.min(
                    100,
                    Math.round((store.ordersCount / limit) * 100)
                  )
                  const isOrangeAlert = pct >= 80

                  return (
                    <tr key={store.id} className="hover:bg-slate-50/70">
                      <td className="py-4 px-5">
                        <div className="font-extrabold text-slate-900">
                          {store.name}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 font-medium">
                          {store.ownerName}{' '}
                          {store.ownerPhone ? `• ${store.ownerPhone}` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Créée le {formatDateFr(store.createdAt)}
                          {store.city ? ` • ${store.city}` : ''}
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span className={state.badgeClass}>
                          <span
                            className={`h-2 w-2 rounded-full ${state.dotClass}`}
                          />
                          {state.label}
                        </span>
                      </td>

                      <td className="py-4 px-4 min-w-[180px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span
                              className={`font-extrabold tabular-nums ${
                                isOrangeAlert
                                  ? 'text-amber-700'
                                  : 'text-slate-800'
                              }`}
                            >
                              {store.ordersCount} / {limit} commandes
                            </span>
                            {isOrangeAlert && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                {pct}%
                              </span>
                            )}
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full rounded-full transition-all ${
                                isOrangeAlert
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-[#0F172A] tabular-nums text-xs font-semibold">
                        {formatDateFr(state.dueDate)}
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewStore(store)}
                            title="Aperçu en lecture seule des commandes et statistiques"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-700" />
                            <span>👁️ Aperçu</span>
                          </button>

                          <button
                            type="button"
                            disabled={isRowPending}
                            onClick={() => handleExtend(store)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0F172A] text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            <span>+30 jours</span>
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
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-50 transition-colors cursor-pointer ${
                              isSuspended
                                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                            }`}
                          >
                            {isSuspended ? (
                              <>
                                <PlayCircle className="h-3.5 w-3.5" />
                                <span>Réactiver</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-3.5 w-3.5" />
                                <span>Suspendre</span>
                              </>
                            )}
                          </button>

                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Contacter la boutique sur WhatsApp"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-white shadow-2xs transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span>💬 WhatsApp</span>
                          </a>
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
              const limit = store.freeOrdersLimit || 20
              const pct = Math.min(
                100,
                Math.round((store.ordersCount / limit) * 100)
              )
              const isOrangeAlert = pct >= 80

              return (
                <div key={store.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-slate-900">
                        {store.name}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {store.ownerName}{' '}
                        {store.ownerPhone ? `· ${store.ownerPhone}` : ''}
                      </p>
                    </div>
                    <span className={`${state.badgeClass} shrink-0`}>
                      <span
                        className={`h-2 w-2 rounded-full ${state.dotClass}`}
                      />
                      {state.label}
                    </span>
                  </div>

                  {/* Jauge mobile X / 20 commandes */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-extrabold ${
                          isOrangeAlert ? 'text-amber-700' : 'text-slate-800'
                        }`}
                      >
                        {store.ordersCount} / {limit} commandes
                      </span>
                      {isOrangeAlert && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                          ⚠️ {pct}% du quota
                        </span>
                      )}
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          isOrangeAlert ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Créée : {formatDateFr(store.createdAt)}</span>
                    <span className="font-semibold text-slate-700">
                      Échéance : {formatDateFr(state.dueDate)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewStore(store)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>👁️ Aperçu</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRowPending}
                      onClick={() => handleExtend(store)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      <span>+30 jours</span>
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
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border disabled:opacity-50 cursor-pointer ${
                        isSuspended
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-rose-700 border-rose-200'
                      }`}
                    >
                      {isSuspended ? 'Réactiver' : 'Suspendre'}
                    </button>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>💬 WhatsApp</span>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {typeof totalCount === 'number' && (
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <ServerPagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            basePath={basePath}
            lang="fr"
          />
        </div>
      )}

      {/* Modale 👁️ Aperçu Support (Lecture seule des commandes et statistiques de la boutique) */}
      {previewStore && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white border border-slate-200 shadow-2xl">
            <div className="sticky top-0 z-10 bg-[#0B132B] text-white px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-extrabold truncate">
                      {previewStore.name}
                    </h3>
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      Lecture seule
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate">
                    Gérant : {previewStore.ownerName}{' '}
                    {previewStore.ownerPhone
                      ? `• ${previewStore.ownerPhone}`
                      : ''}
                    {previewStore.city ? ` • ${previewStore.city}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewStore(null)}
                className="rounded-xl bg-white/10 hover:bg-white/20 p-2 text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Statistiques rapides de la boutique */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">
                    Volume Ventes
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-black text-slate-900 tabular-nums">
                    {formatFcfa(previewStore.totalRevenueFcfa ?? 0)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">
                    Total Commandes
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-black text-slate-900 tabular-nums">
                    {previewStore.ordersCount}
                  </p>
                </div>

                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200 p-3.5">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase">
                    Livrées
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-black text-emerald-900 tabular-nums">
                    {previewStore.deliveredOrdersCount ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-3.5">
                  <p className="text-[11px] font-bold text-amber-700 uppercase">
                    En cours
                  </p>
                  <p className="mt-1 text-base sm:text-lg font-black text-amber-900 tabular-nums">
                    {previewStore.pendingOrdersCount ?? 0}
                  </p>
                </div>
              </div>

              {/* Liste des dernières commandes en lecture seule */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Dernières commandes de la boutique</span>
                  </h4>
                  <span className="text-xs font-semibold text-slate-500">
                    {getEffectiveState(previewStore).label}
                  </span>
                </div>

                {!previewStore.recentOrders ||
                previewStore.recentOrders.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center text-xs text-slate-500">
                    Aucune commande enregistrée pour cette boutique.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                    {previewStore.recentOrders.map((ord) => {
                      const badge = translateOrderStatus(ord.status)
                      return (
                        <div
                          key={ord.id}
                          className="px-4 py-3 bg-white flex items-center justify-between gap-3 text-xs sm:text-sm"
                        >
                          <div>
                            <span className="font-mono font-extrabold text-slate-900">
                              {ord.numberLabel}
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {formatDateFr(ord.orderedAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-slate-900 tabular-nums">
                              {formatFcfa(ord.amountFcfa)}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                <a
                  href={buildWhatsAppUrl(
                    previewStore,
                    getEffectiveState(previewStore).key
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>💬 Contacter le gérant sur WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewStore(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Fermer l&apos;aperçu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
