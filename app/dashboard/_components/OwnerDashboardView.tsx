'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DailyCashSummaryModal } from '@/components/dashboard/DailyCashSummaryModal'

export interface DashboardOrderItem {
  id: string
  status: string
  total_amount: number
  delivery_fee: number
  ordered_at: string
  customers?: {
    full_name?: string | null
  } | null
}

export interface DashboardDeliveryItem {
  id: string
  order_id: string
  status: string
  created_at: string
  delivered_at: string | null
}

export interface DashboardPaymentItem {
  id: string
  order_id: string
  amount: number
  status: string
  reference?: string | null
  paid_at: string | null
  created_at: string
}

export interface DashboardSettlementItem {
  id: string
  amount: number
  status: string
  paid_at: string | null
  created_at: string
}

type PeriodFilter = 'today' | '7d' | '30d'

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function isInPeriod(dateStr: string | null | undefined, period: PeriodFilter): boolean {
  if (!dateStr) return false
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return false

  const now = new Date()
  if (period === 'today') {
    return (
      target.getFullYear() === now.getFullYear() &&
      target.getMonth() === now.getMonth() &&
      target.getDate() === now.getDate()
    )
  }

  const days = period === '7d' ? 6 : 29
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days)
  return target >= start
}

function getOrderBadge(status: string, hasFailedDelivery: boolean) {
  if (hasFailedDelivery || status === 'cancelled') {
    return {
      label: status === 'cancelled' ? 'Annulée' : 'Échec',
      className: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-500',
    }
  }
  if (status === 'delivered') {
    return {
      label: 'Livrée',
      className: 'bg-green-50 text-green-700 border-green-200',
      dot: 'bg-green-500',
    }
  }
  const labels: Record<string, string> = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    preparing: 'Préparation',
    shipped: 'En livraison',
  }
  return {
    label: labels[status] ?? 'En attente',
    className: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    dot: 'bg-yellow-500',
  }
}

export default function OwnerDashboardView({
  userName,
  companyName,
  orders,
  deliveries,
  payments,
  settlements,
}: {
  userName: string
  companyName: string
  orders: DashboardOrderItem[]
  deliveries: DashboardDeliveryItem[]
  payments: DashboardPaymentItem[]
  settlements: DashboardSettlementItem[]
}) {
  const [period, setPeriod] = useState<PeriodFilter>('today')
  const [bilanModalOpen, setBilanModalOpen] = useState(false)

  const stats = useMemo(() => {
    const orderById = new Map<string, DashboardOrderItem>()
    for (const o of orders) {
      orderById.set(o.id, o)
    }

    const failedOrderIds = new Set<string>()
    for (const d of deliveries) {
      if (d.status === 'failed') failedOrderIds.add(d.order_id)
    }

    const filteredOrders = orders.filter((o) => isInPeriod(o.ordered_at, period))
    const validOrders = filteredOrders.filter((o) => o.status !== 'cancelled')
    const salesCount = validOrders.length
    const salesRevenue = validOrders.reduce((sum, o) => sum + Number(o.total_amount), 0)
    const pendingToProcess = filteredOrders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed'
    ).length

    const filteredDeliveries = deliveries.filter((d) =>
      isInPeriod(d.delivered_at ?? d.created_at, period)
    )
    const inProgressDeliveries = filteredDeliveries.filter(
      (d) => d.status === 'in_transit' || d.status === 'assigned'
    ).length
    const succeededDeliveries = filteredDeliveries.filter(
      (d) => d.status === 'delivered'
    ).length
    const failedDeliveries = filteredDeliveries.filter(
      (d) => d.status === 'failed'
    ).length

    const completedPayments = payments.filter(
      (p) => p.status === 'completed' && isInPeriod(p.paid_at ?? p.created_at, period)
    )
    const totalCollectedByCouriers = completedPayments
      .filter((p) => (p.reference ?? '').startsWith('Livreur:'))
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const courierPaymentByOrderAll = new Map<string, number>()
    for (const p of payments) {
      if (p.status === 'completed' && (p.reference ?? '').startsWith('Livreur:')) {
        courierPaymentByOrderAll.set(
          p.order_id,
          (courierPaymentByOrderAll.get(p.order_id) ?? 0) + Number(p.amount)
        )
      }
    }

    const deliveredOrderIds = new Set<string>()
    for (const d of deliveries) {
      if (d.status === 'delivered' && isInPeriod(d.delivered_at ?? d.created_at, period)) {
        deliveredOrderIds.add(d.order_id)
      }
    }

    let expectedNet = 0
    for (const orderId of deliveredOrderIds) {
      const order = orderById.get(orderId)
      const collectedOnDelivery = courierPaymentByOrderAll.get(orderId) ?? 0
      const fee = Number(order?.delivery_fee ?? 0)
      expectedNet += Math.max(0, collectedOnDelivery - fee)
    }

    const totalSettled = settlements
      .filter((s) => s.status === 'paid' && isInPeriod(s.paid_at ?? s.created_at, period))
      .reduce((sum, s) => sum + Number(s.amount), 0)

    const remainingGlobalBalance = Math.max(0, expectedNet - totalSettled)

    // Données graphique 7 derniers jours
    const now = new Date()
    const chartDays: {
      key: string
      label: string
      amount: number
      count: number
      isToday: boolean
    }[] = []

    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - offset)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
      const dayOrders = orders.filter((o) => {
        if (o.status === 'cancelled') return false
        const od = new Date(o.ordered_at)
        return (
          od.getFullYear() === d.getFullYear() &&
          od.getMonth() === d.getMonth() &&
          od.getDate() === d.getDate()
        )
      })
      chartDays.push({
        key,
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
        amount: dayOrders.reduce((s, o) => s + Number(o.total_amount), 0),
        count: dayOrders.length,
        isToday: offset === 0,
      })
    }

    const maxChartAmount = Math.max(1, ...chartDays.map((c) => c.amount))

    const latestOrders = [...orders]
      .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime())
      .slice(0, 5)

    return {
      salesCount,
      salesRevenue,
      pendingToProcess,
      inProgressDeliveries,
      succeededDeliveries,
      failedDeliveries,
      totalCollectedByCouriers,
      expectedNet,
      totalSettled,
      remainingGlobalBalance,
      chartDays,
      maxChartAmount,
      latestOrders,
      failedOrderIds,
    }
  }, [orders, deliveries, payments, settlements, period])

  const periodLabel =
    period === 'today' ? "Aujourd'hui" : period === '7d' ? '7 derniers jours' : '30 derniers jours'

  const quickSpaces = [
    { href: '/commandes', icon: '📦', label: 'Commandes', desc: 'Suivre & affecter' },
    { href: '/clients', icon: '👥', label: 'Clients', desc: 'Carnet d’adresses' },
    { href: '/produits', icon: '🏷️', label: 'Produits', desc: 'Catalogue & prix' },
    { href: '/livreurs', icon: '🚴', label: 'Livreurs', desc: 'Équipe terrain' },
    { href: '/paiements', icon: '💳', label: 'Paiements', desc: 'Soldes & caisses' },
  ]

  return (
    <div className="space-y-6">
      {/* 1. En-tête + Sélecteur de période */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-[#1E40AF] text-xs font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{companyName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            Tableau de bord
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Bienvenue, <span className="font-semibold text-gray-700">{userName}</span> • Vue{' '}
            {periodLabel.toLowerCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200/70">
            {(
              [
                { id: 'today', label: "Aujourd'hui" },
                { id: '7d', label: '7 jours' },
                { id: '30d', label: '30 jours' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 ${
                  period === opt.id
                    ? 'bg-white text-[#1E40AF] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setBilanModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            <span>📊</span>
            <span>Bilan de caisse du jour</span>
          </button>

          <Link
            href="/dashboard/orders?new=1"
            className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E40AF] hover:bg-blue-900 text-white text-sm font-semibold shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <span className="transition-transform duration-200 group-hover:rotate-90">➕</span>
            <span>Nouvelle commande</span>
          </Link>
        </div>
      </div>

      {/* 2. Grille des 4 Cartes KPI (1 col mobile, 2 tablette, 4 desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Ventes du jour */}
        <div className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:-translate-y-1 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Ventes ({period === 'today' ? 'jour' : period})
            </span>
            <span className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E40AF] flex items-center justify-center text-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
              🛍️
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#1E40AF] mt-3 tabular-nums">
            {formatMoney(stats.salesRevenue)}
          </p>
          <p className="text-xs text-gray-500 mt-1.5">
            <span className="font-semibold text-gray-800">{stats.salesCount}</span> commande
            {stats.salesCount !== 1 ? 's' : ''} validée{stats.salesCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* KPI 2 : Commandes à traiter */}
        <Link
          href="/commandes"
          className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:-translate-y-1 hover:shadow-lg hover:border-amber-200 transition-all duration-300 block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Commandes à traiter
            </span>
            <span className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-lg transition-transform duration-300 group-hover:scale-110">
              ⏳
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3 tabular-nums">
            {stats.pendingToProcess}
          </p>
          <p className="text-xs text-amber-700 font-medium mt-1.5 inline-flex items-center gap-1">
            <span>En attente / à confirmer</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </p>
        </Link>

        {/* KPI 3 : Livraisons en cours */}
        <Link
          href="/livreurs"
          className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:-translate-y-1 hover:shadow-lg hover:border-blue-200 transition-all duration-300 block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Livraisons en cours
            </span>
            <span className="w-9 h-9 rounded-lg bg-primary-soft text-primary-soft-text flex items-center justify-center text-lg transition-transform duration-300 group-hover:scale-110 group-hover:translate-x-0.5">
              🚚
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3 tabular-nums">
            {stats.inProgressDeliveries}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] font-semibold">
            <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">
              ✓ {stats.succeededDeliveries} réussie{stats.succeededDeliveries !== 1 ? 's' : ''}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">
              ✕ {stats.failedDeliveries} échec{stats.failedDeliveries !== 1 ? 's' : ''}
            </span>
          </div>
        </Link>

        {/* KPI 4 : Solde à reverser */}
        <Link
          href="/paiements"
          className="group bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:-translate-y-1 hover:shadow-lg hover:border-blue-200 transition-all duration-300 block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Solde à reverser
            </span>
            <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg transition-transform duration-300 group-hover:scale-110">
              💳
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3 tabular-nums">
            {formatMoney(stats.remainingGlobalBalance)}
          </p>
          <p className="text-xs text-gray-500 mt-1.5 flex items-center justify-between">
            <span>Reversé : {formatMoney(stats.totalSettled)}</span>
            <span className="text-[#1E40AF] font-semibold group-hover:translate-x-1 transition-transform">
              Voir →
            </span>
          </p>
        </Link>
      </div>

      {/* 3. Explorer le SaaS (Navigation rapide tactile) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {quickSpaces.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-200 active:scale-[0.98] transition-all duration-200"
          >
            <span className="w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center text-lg transition-all duration-200 group-hover:scale-110">
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 group-hover:text-[#1E40AF] transition-colors truncate">
                {item.label}
              </p>
              <p className="text-[11px] text-gray-500 truncate">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 4. Graphique 7 derniers jours + 5 dernières commandes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Graphique en barres CSS (Ventes 7 derniers jours) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Ventes des 7 derniers jours</h2>
              <p className="text-xs text-gray-500">Survolez une barre pour voir le détail</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1E40AF]">
              7j
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 items-end h-44 pt-8 pb-1 border-b border-gray-100">
            {stats.chartDays.map((day) => {
              const heightPct =
                day.amount > 0
                  ? Math.max(12, Math.round((day.amount / stats.maxChartAmount) * 100))
                  : 4

              return (
                <div
                  key={day.key}
                  className="group relative flex flex-col items-center justify-end h-full"
                >
                  {/* Tooltip au survol */}
                  <div className="pointer-events-none opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:-translate-y-2 transition-all duration-200 absolute -top-9 z-10 whitespace-nowrap bg-gray-900 text-white text-[10px] font-semibold px-2 py-1 rounded-lg shadow-md">
                    {formatMoney(day.amount)} ({day.count})
                  </div>

                  <div className="w-full flex items-end justify-center h-full">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[30px] rounded-t-lg transition-all duration-300 origin-bottom group-hover:scale-y-105 cursor-pointer ${
                        day.amount === 0
                          ? 'bg-gray-100 group-hover:bg-gray-200'
                          : day.isToday
                            ? 'bg-gradient-to-t from-[#1E40AF] to-blue-500 shadow-sm'
                            : 'bg-blue-200 group-hover:bg-[#1E40AF]'
                      }`}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-7 gap-2 pt-2 text-center">
            {stats.chartDays.map((day) => (
              <span
                key={day.key}
                className={`text-[11px] capitalize ${
                  day.isToday ? 'font-bold text-[#1E40AF]' : 'text-gray-500'
                }`}
              >
                {day.label}
              </span>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Encaissé livreurs : {formatMoney(stats.totalCollectedByCouriers)}</span>
            <span className="font-semibold text-gray-800">
              Net attendu : {formatMoney(stats.expectedNet)}
            </span>
          </div>
        </div>

        {/* Liste des 5 dernières commandes */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">5 dernières commandes</h2>
              <p className="text-xs text-gray-500">Activité récente en temps réel</p>
            </div>
            <Link
              href="/commandes"
              className="text-xs font-semibold text-[#1E40AF] hover:underline inline-flex items-center gap-1"
            >
              Tout voir →
            </Link>
          </div>

          {stats.latestOrders.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500 mb-3">Aucune commande enregistrée.</p>
              <Link
                href="/dashboard/orders?new=1"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E40AF] text-white text-xs font-semibold hover:bg-blue-900 transition"
              >
                ➕ Créer une commande
              </Link>
            </div>
          ) : (
            <>
              {/* Desktop : tableau compact */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase text-gray-400 border-b border-gray-100">
                      <th className="pb-2.5">Numéro</th>
                      <th className="pb-2.5">Client</th>
                      <th className="pb-2.5">Montant</th>
                      <th className="pb-2.5 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {stats.latestOrders.map((order) => {
                      const badge = getOrderBadge(
                        order.status,
                        stats.failedOrderIds.has(order.id)
                      )
                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-blue-50/40 transition-colors duration-150"
                        >
                          <td className="py-3 font-mono font-semibold text-[#1E40AF]">
                            #{order.id.slice(0, 6).toUpperCase()}
                          </td>
                          <td className="py-3 text-gray-700 font-medium">
                            {order.customers?.full_name || `Client #${order.id.slice(0, 4).toUpperCase()}`}
                          </td>
                          <td className="py-3 font-bold text-gray-900 tabular-nums">
                            {formatMoney(order.total_amount)}
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile : cartes compactes */}
              <div className="sm:hidden space-y-2.5">
                {stats.latestOrders.map((order) => {
                  const badge = getOrderBadge(
                    order.status,
                    stats.failedOrderIds.has(order.id)
                  )
                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border border-gray-100 p-3 flex items-center justify-between gap-2 hover:border-blue-200 transition-colors"
                    >
                      <div>
                        <span className="font-mono text-xs font-bold text-[#1E40AF]">
                          #{order.id.slice(0, 6).toUpperCase()}
                        </span>
                        <p className="text-sm font-semibold text-gray-900">
                          {order.customers?.full_name || `Client #${order.id.slice(0, 4).toUpperCase()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {formatMoney(order.total_amount)}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border mt-1 ${badge.className}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <DailyCashSummaryModal
        isOpen={bilanModalOpen}
        onClose={() => setBilanModalOpen(false)}
        companyName={companyName}
        totalSalesCount={stats.salesCount}
        totalSalesRevenueFcfa={stats.salesRevenue}
        directShopCollectedFcfa={Math.max(
          0,
          stats.salesRevenue - stats.totalCollectedByCouriers
        )}
        expectedFromCouriersFcfa={stats.expectedNet}
        settledByCouriersFcfa={stats.totalSettled}
        discrepancyFcfa={stats.totalSettled - stats.expectedNet}
      />
    </div>
  )
}
