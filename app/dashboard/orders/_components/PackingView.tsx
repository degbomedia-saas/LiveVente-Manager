'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Package, User, Phone, MapPin, Bike, MessageCircle, ClipboardList, Link2, Hourglass, Zap, Check, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { confirmOrder, markOrderPacked } from '@/app/actions/orders'
import { toWhatsAppUrl } from '@/lib/validations/orders'
import { type OrderRow, type OrderCourierOption } from './OrdersView'

interface PackingViewProps {
  orders: OrderRow[]
  couriers: OrderCourierOption[]
  companyName?: string
  onOrderUpdated: (updatedOrder: Partial<OrderRow> & { id: string }) => void
  onAssignDelivery?: (order: OrderRow) => void
}

function formatMoney(amount: number) {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`
}

function extractParcelNumber(order: OrderRow): string | null {
  if (order.parcel_number && order.parcel_number.trim() !== '') {
    return order.parcel_number.startsWith('#') ? order.parcel_number : `#${order.parcel_number}`
  }
  const match = (order.notes || '').match(/#(\d+)/)
  return match ? `#${match[1]}` : null
}

function extractMissingInfo(notes?: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/\[INFO MANQUANTE:\s*([^\]]+)\]/i)
  return match ? match[1].trim() : null
}

function cleanPhone(raw?: string | null): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('228')) {
    return digits.slice(3)
  }
  return digits.length >= 8 ? digits.slice(-8) : digits
}

function isToday(dateStr?: string | null): boolean {
  if (!dateStr) return false
  const target = new Date(dateStr)
  if (Number.isNaN(target.getTime())) return false
  const now = new Date()
  return (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  )
}

export default function PackingView({
  orders,
  couriers,
  companyName = 'Élégance Wax Lomé',
  onOrderUpdated,
  onAssignDelivery,
}: PackingViewProps) {
  const router = useRouter()
  const [subTab, setSubTab] = useState<'to_confirm' | 'to_pack' | 'in_transit'>('to_pack')
  const [selectedCourierByOrder, setSelectedCourierByOrder] = useState<Record<string, string>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [checkedParcels, setCheckedParcels] = useState<Record<string, boolean>>({})
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null)
  const [copiedCourierId, setCopiedCourierId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // 1. À confirmer : pending_confirmation, to_confirm, pending sans colis ou information manquante
  const toConfirmOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.status === 'cancelled' || o.status === 'delivered') return false
      const pNum = extractParcelNumber(o)
      const hasMissing = Boolean(extractMissingInfo(o.notes))
      return (
        o.status === 'pending_confirmation' ||
        (o.status as string) === 'to_confirm' ||
        (o.status === 'pending' && !pNum) ||
        hasMissing
      )
    })
  }, [orders])

  // 2. À emballer : confirmed ou (pending AVEC numéro de colis déjà attribué) sans info manquante et NON emballé
  const toPackOrders = useMemo(() => {
    return orders.filter((o) => {
      if (extractMissingInfo(o.notes)) return false
      const pNum = extractParcelNumber(o)
      const isMarkedPacked = o.status === 'packed' || (o.notes || '').includes('[EMBALLÉ]')
      if (isMarkedPacked) return false

      return (
        o.status === 'confirmed' ||
        (o.status === 'pending' && Boolean(pNum))
      )
    })
  }, [orders])

  // 3. Expédiées / Livraisons : packed, [EMBALLÉ], preparing, assigned, in_transit
  const inTransitOrders = useMemo(() => {
    return orders.filter((o) => {
      const isMarkedPacked = o.status === 'packed' || (o.notes || '').includes('[EMBALLÉ]')
      return (
        isMarkedPacked ||
        ['assigned', 'in_transit'].includes(o.status)
      )
    })
  }, [orders])

  // Regroupement des commandes du jour par cliente / téléphone (groupage de commandes)
  const todayClientGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        orders: OrderRow[]
        parcels: string[]
        hasZeroDeliveryFee: boolean
      }
    >()

    for (const o of orders) {
      const phone = cleanPhone(o.customers?.phone)
      if (!phone || !isToday(o.ordered_at)) continue

      const pLabel = extractParcelNumber(o) || `#${o.id.slice(0, 6).toUpperCase()}`
      const existing = map.get(phone)
      if (!existing) {
        map.set(phone, {
          orders: [o],
          parcels: [pLabel],
          hasZeroDeliveryFee: Number(o.delivery_fee) === 0,
        })
      } else {
        existing.orders.push(o)
        existing.parcels.push(pLabel)
        if (Number(o.delivery_fee) === 0) existing.hasZeroDeliveryFee = true
      }
    }
    return map
  }, [orders])

  // Regroupement détaillé par livreur pour passation et checklist
  interface CourierTourItem {
    courierId: string
    courierName: string
    courierPhone: string | null
    parcels: Array<{
      orderId: string
      parcelLabel: string
      clientName: string
      clientPhone: string
      city: string
      amountDue: number
      isGrouped: boolean
    }>
    totalAmountToCollect: number
  }

  const courierTours = useMemo(() => {
    const map = new Map<string, CourierTourItem>()

    for (const o of orders) {
      if (
        o.deliveries &&
        o.deliveries.length > 0 &&
        o.status !== 'cancelled' &&
        o.status !== 'delivered'
      ) {
        const courier = o.deliveries[0].profiles
        const courierId = o.deliveries[0].courier_id
        if (courier && courierId) {
          if (!map.has(courierId)) {
            map.set(courierId, {
              courierId,
              courierName: courier.full_name,
              courierPhone: courier.phone,
              parcels: [],
              totalAmountToCollect: 0,
            })
          }

          const parcelLabel = extractParcelNumber(o) || `#${o.id.slice(0, 6).toUpperCase()}`
          const clientName = o.customers?.full_name || 'Client'
          const clientPhone = cleanPhone(o.customers?.phone)
          const city = o.customers?.city || o.customers?.address || 'Quartier'
          const totalPaid = (o.payments ?? [])
            .filter((p) => p.status === 'completed')
            .reduce((sum, p) => sum + Number(p.amount), 0)
          const amountDue = Math.max(0, o.total_amount - totalPaid)

          const tour = map.get(courierId)!
          tour.parcels.push({
            orderId: o.id,
            parcelLabel,
            clientName,
            clientPhone,
            city,
            amountDue,
            isGrouped: false,
          })
          tour.totalAmountToCollect += amountDue
        }
      }
    }

    // Détection des doublons de clients dans la tournée du livreur (groupage)
    for (const tour of map.values()) {
      const phoneCounts = new Map<string, number>()
      for (const p of tour.parcels) {
        if (p.clientPhone) {
          phoneCounts.set(p.clientPhone, (phoneCounts.get(p.clientPhone) ?? 0) + 1)
        }
      }
      for (const p of tour.parcels) {
        if (p.clientPhone && (phoneCounts.get(p.clientPhone) ?? 0) > 1) {
          p.isGrouped = true
        }
      }
    }

    return Array.from(map.values())
  }, [orders])

  function handleConfirm(orderId: string) {
    startTransition(async () => {
      const res = await confirmOrder(orderId)
      if (res.error) {
        alert(res.error)
        return
      }
      onOrderUpdated({
        id: orderId,
        status: 'confirmed',
        parcel_number: res.parcelNumber,
      })
      router.refresh()
    })
  }

  function handleMarkPackedGroup(orderIds: string[], explicitCourierId?: string | null) {
    const firstOrder = orders.find((o) => o.id === orderIds[0])
    const soleCourierId = couriers.length === 1 ? couriers[0].id : null
    const chosenCourier =
      explicitCourierId ??
      selectedCourierByOrder[orderIds[0]] ??
      firstOrder?.deliveries?.[0]?.courier_id ??
      soleCourierId ??
      null

    startTransition(async () => {
      for (const orderId of orderIds) {
        const res = await markOrderPacked(orderId, chosenCourier)
        if (res.error) {
          alert(res.error)
          return
        }
        onOrderUpdated({
          id: orderId,
          status: res.orderStatus || 'packed',
          parcel_number: res.parcelNumber,
          deliveries: res.delivery ? [res.delivery] : undefined,
        })
      }
      router.refresh()
    })
  }

  function toggleCheckParcel(orderId: string) {
    setCheckedParcels((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }))
  }

  function handleSendWhatsappTour(tour: CourierTourItem) {
    const count = tour.parcels.length
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    const parcelsFormatted = tour.parcels
      .map((p, idx) => {
        return [
          `📦 *COLIS ${p.parcelLabel}*${p.isGrouped ? ' _[🔗 Groupage]_' : ''}`,
          `👤 Client : *${p.clientName}*`,
          `📍 Quartier : ${p.city}`,
          `💰 À PERCEVOIR : *${formatMoney(p.amountDue)}*`,
        ].join('\n')
      })
      .join('\n\n─────────────────────\n\n')

    const message = [
      `🚀 *TOURNEE LIVRAISON DU JOUR*`,
      `📅 ${dateStr}`,
      `🚴 *Livreur : ${tour.courierName}* (${count} colis)`,
      `═════════════════════`,
      ``,
      parcelsFormatted,
      ``,
      `═════════════════════`,
      `💵 *TOTAL LIQUIDE À RAPPORTER EN CAISSE :*`,
      `👉 *${formatMoney(tour.totalAmountToCollect)}*`,
      ``,
      `Bonne route et prudence à moto ! 🏍️💨`,
    ].join('\n')

    if (tour.courierPhone) {
      window.open(toWhatsAppUrl(tour.courierPhone, message), '_blank')
    } else {
      navigator.clipboard.writeText(message)
      setCopiedCourierId(tour.courierId)
      setTimeout(() => setCopiedCourierId(null), 2500)
    }
  }

  function handleCopySummary(order: OrderRow) {
    const parcel = extractParcelNumber(order) || `#${order.id.slice(0, 6).toUpperCase()}`
    const client = order.customers?.full_name || 'Client'
    const phone = order.customers?.phone || ''
    const location = [order.customers?.city, order.customers?.address].filter(Boolean).join(' - ')
    const items = order.order_items.map((i) => `• ${i.quantity}x ${i.product_name}`).join('\n')
    const totalPaid = (order.payments ?? [])
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0)
    const remainingDue = Math.max(0, order.total_amount - totalPaid)

    const text = `📦 COLIS ${parcel}\n👤 Client : ${client} (${phone})\n📍 Adresse : ${location}\n\n🛍️ Articles :\n${items}\n\n💰 À encaisser : ${formatMoney(remainingDue)}`

    navigator.clipboard.writeText(text)
    setCopiedOrderId(order.id)
    setTimeout(() => setCopiedOrderId(null), 2500)
  }

  const currentDisplayList =
    subTab === 'to_confirm'
      ? toConfirmOrders
      : subTab === 'to_pack'
      ? toPackOrders
      : inTransitOrders

  const groupedDisplayList = useMemo(() => {
    const map = new Map<string, OrderRow[]>()
    for (const o of currentDisplayList) {
      const phone = cleanPhone(o.customers?.phone)
      const key = phone || o.customers?.full_name?.trim().toLowerCase() || o.id
      const list = map.get(key)
      if (list) list.push(o)
      else map.set(key, [o])
    }
    return Array.from(map.entries()).map(([groupKey, groupOrders]) => ({
      groupKey,
      orders: groupOrders,
    }))
  }, [currentDisplayList])

  return (
    <div className="space-y-6">
      {/* 1. Baromètre / Onglets de filtre de Colisage */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setSubTab('to_confirm')}
          className={`bg-white rounded-2xl p-4 text-left shadow-sm transition-all border ${
            subTab === 'to_confirm'
              ? 'ring-2 ring-primary-ring border-transparent'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">1. À confirmer</p>
            <span className="bg-primary-soft text-primary-soft-text font-bold px-2 py-0.5 rounded-full text-xs">
              {toConfirmOrders.length}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{toConfirmOrders.length}</p>
          <p className="text-xs text-slate-500 mt-1">Commandes sans livreur & en attente de validation</p>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('to_pack')}
          className={`bg-white rounded-2xl p-4 text-left shadow-sm transition-all border ${
            subTab === 'to_pack'
              ? 'ring-2 ring-primary-ring border-transparent'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">2. À emballer</p>
            <span className="bg-primary-soft text-primary-soft-text font-bold px-2 py-0.5 rounded-full text-xs">
              {toPackOrders.length}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{toPackOrders.length}</p>
          <p className="text-xs text-slate-500 mt-1">Colis N° attribué, emballage & affectation livreur</p>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('in_transit')}
          className={`bg-white rounded-2xl p-4 text-left shadow-sm transition-all border ${
            subTab === 'in_transit'
              ? 'ring-2 ring-primary-ring border-transparent'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">3. Expédiées / Livraisons</p>
            <span className="bg-primary-soft text-primary-soft-text font-bold px-2 py-0.5 rounded-full text-xs">
              {inTransitOrders.length}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{inTransitOrders.length}</p>
          <p className="text-xs text-slate-500 mt-1">Colis emballés, checklist & tournées livreurs</p>
        </button>
      </div>

      {/* 2. Checklist & Bordereau de passation par livreur (Affiché UNIQUEMENT sur l'onglet 3 : Expédiées / Livraisons) */}
      {subTab === 'in_transit' && courierTours.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary-soft border border-primary-border flex items-center justify-center text-primary">
              <ClipboardList className="w-5 h-5" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="font-semibold text-base text-slate-900">Checklist de passation aux livreurs</h3>
              <p className="text-xs text-slate-500">
                Vérifiez et cochez les paquets physiques confiés pour le ramassage.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courierTours.map((tour) => {
              const loadedCount = tour.parcels.filter((p) => checkedParcels[p.orderId]).length

              return (
                <div
                  key={tour.courierId}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 mb-4 space-y-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-base flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{tour.courierName}</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tour.parcels.length} colis • {loadedCount}/{tour.parcels.length} vérifié{loadedCount > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">Total liquide</p>
                        <p className="text-lg font-bold text-slate-900">
                          {formatMoney(tour.totalAmountToCollect)}
                        </p>
                      </div>
                    </div>

                    {/* Liste aérée des colis à cocher */}
                    <div className="mt-3 space-y-2">
                      {tour.parcels.map((p) => {
                        const isChecked = checkedParcels[p.orderId]
                        return (
                          <button
                            key={p.orderId}
                            type="button"
                            onClick={() => toggleCheckParcel(p.orderId)}
                            className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-3 transition border ${
                              isChecked
                                ? 'bg-emerald-50/70 border-emerald-200 text-slate-900'
                                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                                  isChecked
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'border-slate-300 bg-white text-transparent'
                                }`}
                              >
                                <Check className="w-3 h-3" strokeWidth={2.5} />
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs shrink-0">
                                <Package className="w-3 h-3" strokeWidth={1.75} />
                                <span>Colis {p.parcelLabel}</span>
                              </span>
                              <span className="font-medium text-slate-800 text-sm truncate ml-0.5">
                                {p.clientName}
                              </span>
                              {p.isGrouped && (
                                <span className="px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 font-semibold text-[10px] shrink-0">
                                  Groupé
                                </span>
                              )}
                            </div>
                            <span className="font-semibold text-sm text-slate-900 shrink-0 tabular-nums">
                              {formatMoney(p.amountDue)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center">
                    <button
                      type="button"
                      onClick={() => handleSendWhatsappTour(tour)}
                      className="w-full h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" strokeWidth={1.75} />
                      <span>
                        {copiedCourierId === tour.courierId ? 'Copié !' : 'Partager la liste WhatsApp'}
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. Liste des commandes selon le sous-onglet sélectionné */}
      {currentDisplayList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">
            {subTab === 'to_confirm' ? '✓' : subTab === 'to_pack' ? '✓' : '·'}
          </div>
          <p className="font-semibold text-slate-900 text-base">
            {subTab === 'to_confirm'
              ? 'Aucune commande brute à confirmer'
              : subTab === 'to_pack'
              ? 'Tous les colis sont emballés !'
              : 'Aucun colis en cours d\'expédition'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {subTab === 'to_confirm'
              ? 'Toutes les commandes reçues ont été validées et ont un numéro de colis.'
              : subTab === 'to_pack'
              ? 'Consultez l\'onglet "Expédiées / Livraisons" pour le suivi des livreurs.'
              : 'Les colis emballés apparaîtront ici dès que vous les marquerez comme emballés.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4">
          {groupedDisplayList.map(({ groupKey, orders: groupOrders }) => {
            const primaryOrder = groupOrders[0]
            const isGroup = groupOrders.length > 1
            const isExpanded = Boolean(expandedGroups[groupKey])
            const allItems = groupOrders.flatMap((o) => o.order_items)
            const totalItemsCount = allItems.reduce((s, it) => s + Number(it.quantity || 1), 0)
            const totalDue = groupOrders.reduce((sum, o) => {
              const paid = (o.payments ?? [])
                .filter((p) => p.status === 'completed')
                .reduce((s, p) => s + Number(p.amount), 0)
              return sum + Math.max(0, o.total_amount - paid)
            }, 0)

            const parcelLabels = groupOrders
              .map((o) => extractParcelNumber(o))
              .filter(Boolean) as string[]
            const assignedDelivery = groupOrders.find((o) => o.deliveries?.[0])?.deliveries?.[0]
            const clientPhone = primaryOrder.customers?.phone ?? ''
            const chosenCourierId =
              selectedCourierByOrder[groupKey] ??
              selectedCourierByOrder[primaryOrder.id] ??
              assignedDelivery?.courier_id ??
              (couriers.length === 1 ? couriers[0].id : '')

            const missingInfos = Array.from(
              new Set(
                groupOrders
                  .map((o) => extractMissingInfo(o.notes))
                  .filter(Boolean) as string[]
              )
            )
            const missingInfoText = missingInfos.join(', ')

            const locationLabel =
              [primaryOrder.customers?.city, primaryOrder.customers?.address]
                .filter(Boolean)
                .join(' — ') || 'Quartier non précisé'

            return (
              <div
                key={groupKey}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 md:p-5 mb-3.5 space-y-3.5 transition-all hover:border-slate-300"
              >
                {/* Bandeau Groupage si plusieurs commandes de la même cliente */}
                {isGroup && (
                  <div className="bg-primary-soft border border-primary-border rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs font-semibold text-primary-soft-text">
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
                      <span>
                        Colisage groupé : {primaryOrder.customers?.full_name ?? 'Client'} ({groupOrders.length} commandes / {totalItemsCount} article{totalItemsCount > 1 ? 's' : ''})
                      </span>
                    </span>
                  </div>
                )}

                {/* En-tête compact synthétique */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {parcelLabels.length > 0 ? (
                        parcelLabels.map((lbl, idx) => (
                          <span
                            key={`${lbl}-${idx}`}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            <Package className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Colis {lbl}</span>
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                          <Hourglass className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>Sans N°</span>
                        </span>
                      )}
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {totalItemsCount} article{totalItemsCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <p className="text-base font-semibold text-slate-900 truncate">
                      {primaryOrder.customers?.full_name ?? 'Client'}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                        {locationLabel}
                      </span>
                      {clientPhone && (
                        <span className="inline-flex items-center gap-1">
                          • <Phone className="w-3 h-3 text-slate-400" strokeWidth={1.75} /> {clientPhone}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide font-medium">À encaisser</p>
                    <p className="text-lg font-bold text-slate-900">{formatMoney(totalDue)}</p>
                  </div>
                </div>

                {/* Alerte Information Manquante dans onglet À confirmer */}
                {subTab === 'to_confirm' && missingInfoText && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2 text-xs text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.75} />
                      <div>
                        <span className="font-bold">⚠️ Incomplet : </span>
                        <span className="font-medium">{missingInfoText}</span>
                      </div>
                    </div>
                    {clientPhone && (
                      <a
                        href={toWhatsAppUrl(
                          clientPhone,
                          `Bonjour ${primaryOrder.customers?.full_name || 'Client(e)'}, votre commande chez ${companyName} est en attente car il nous manque : ${missingInfoText}. Merci de nous le préciser.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Demander l&apos;info manquante</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Bouton Accordéon : Déplier / Replier les articles */}
                <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedGroups((prev) => ({ ...prev, [groupKey]: !isExpanded }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
                  >
                    <span>
                      {isExpanded ? 'Masquer le détail des articles' : `Voir les ${allItems.length} ligne(s) d'articles à emballer`}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-3.5 bg-primary-soft border-t border-slate-200/80 divide-y divide-primary-border">
                      {allItems.map((item) => {
                        const m = item.product_name.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
                        const baseName = m ? m[1] : item.product_name
                        const variants = m
                          ? m[2].split(/[,/|-]/).map((v) => v.trim()).filter(Boolean)
                          : []
                        return (
                          <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center gap-3">
                            <span className="w-8 h-8 shrink-0 rounded-lg bg-white border border-primary-border text-primary-soft-text font-semibold text-sm flex items-center justify-center">
                              {item.quantity}×
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 leading-tight">{baseName}</p>
                              {variants.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {variants.map((v) => (
                                    <span
                                      key={v}
                                      className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-medium"
                                    >
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Affectation rapide livreur (s'applique à tout le lot groupé) */}
                {(subTab === 'to_pack' || subTab === 'to_confirm') && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Bike className="w-4 h-4" strokeWidth={1.75} />
                        <span>
                          {isGroup ? 'Affecter le livreur au lot (1 clic) :' : 'Affecter le livreur (1 clic) :'}
                        </span>
                      </label>
                    </div>

                    {couriers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {couriers.map((c) => {
                          const firstName = c.full_name.split(' ')[0]
                          const isSelected = chosenCourierId === c.id
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCourierByOrder((prev) => ({
                                  ...prev,
                                  [groupKey]: isSelected ? '' : c.id,
                                  [primaryOrder.id]: isSelected ? '' : c.id,
                                }))
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                                isSelected
                                  ? 'bg-primary text-white border-primary ring-2 ring-primary-soft'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-primary-border hover:bg-primary-soft'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1">
                                <Bike className="w-3.5 h-3.5" strokeWidth={1.75} />
                                {firstName}
                              </span>
                              {isSelected && <span className="text-white font-black">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Aucun livreur disponible</p>
                    )}
                  </div>
                )}

                {/* Livreur déjà assigné pour l'onglet Expédiées */}
                {subTab === 'in_transit' && (
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-slate-700 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <Bike className="w-3.5 h-3.5" strokeWidth={1.75} />
                        Livreur :
                      </span>
                      <strong className="font-bold">
                        {assignedDelivery?.profiles?.full_name ||
                          couriers.find((c) => c.id === chosenCourierId)?.full_name ||
                          'Non assigné'}
                      </strong>
                    </div>
                    {onAssignDelivery && (
                      <button
                        type="button"
                        onClick={() => onAssignDelivery(primaryOrder)}
                        className="px-3 py-1.5 rounded-lg bg-primary text-white font-semibold text-[11px] hover:bg-primary-hover transition shrink-0"
                      >
                        {assignedDelivery ? 'Changer' : 'Affecter'}
                      </button>
                    )}
                  </div>
                )}

                {/* Actions spécifiques */}
                <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    {clientPhone && (() => {
                      const parcelDisplay = (
                        parcelLabels.join(' + ') || `#${primaryOrder.id.slice(0, 6).toUpperCase()}`
                      ).replace(/^#/, '')
                      const courierObj =
                        assignedDelivery?.profiles ||
                        couriers.find((c) => c.id === chosenCourierId) ||
                        null
                      const courierName = courierObj?.full_name || 'notre livreur'
                      const courierPhone = courierObj?.phone ? ` (${courierObj.phone})` : ''
                      const itemsText = allItems
                        .map((i) => `${i.quantity}x ${i.product_name}`)
                        .join(', ')
                      const dispatchMsg = [
                        `Bonjour ${primaryOrder.customers?.full_name || 'Client(e)'} ! ✨`,
                        `Votre commande chez ${companyName} (Colis #${parcelDisplay}) est en route pour ${locationLabel}.`,
                        '',
                        `📦 Contenu : ${itemsText}`,
                        `💰 Montant à payer à la livraison : ${Math.round(totalDue).toLocaleString('fr-FR')} FCFA`,
                        `🛵 Votre livreur est ${courierName}${courierPhone}.`,
                        '',
                        'Merci pour votre confiance !',
                      ].join('\n')

                      return (
                        <a
                          href={toWhatsAppUrl(clientPhone, dispatchMsg)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center gap-1"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                            Avertir cliente WhatsApp
                          </span>
                        </a>
                      )
                    })()}
                    <button
                      type="button"
                      onClick={() => handleCopySummary(primaryOrder)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
                    >
                      {copiedOrderId === primaryOrder.id ? 'Copié !' : 'Copier'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {subTab === 'to_confirm' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => groupOrders.forEach((o) => handleConfirm(o.id))}
                          className="h-10 px-4 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" strokeWidth={1.75} />
                          <span>Confirmer</span>
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleMarkPackedGroup(
                              groupOrders.map((o) => o.id),
                              chosenCourierId || null
                            )
                          }
                          className="h-10 px-4 rounded-xl text-sm font-medium text-white bg-primary hover:bg-primary-hover transition shadow-sm flex items-center gap-1.5"
                        >
                          <Zap className="w-4 h-4" strokeWidth={1.75} />
                          <span>Emballer direct</span>
                        </button>
                      </div>
                    )}

                    {subTab === 'to_pack' && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          handleMarkPackedGroup(
                            groupOrders.map((o) => o.id),
                            chosenCourierId || null
                          )
                        }
                        className="h-10 px-4 rounded-xl text-sm font-medium text-white bg-primary hover:bg-primary-hover transition shadow-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                        <span>
                          {chosenCourierId
                            ? `Emballer & Assigner (${couriers.find((c) => c.id === chosenCourierId)?.full_name.split(' ')[0] || 'Livreur'})`
                            : isGroup
                            ? 'Emballer le lot'
                            : 'Marquer comme emballé'}
                        </span>
                      </button>
                    )}

                    {subTab === 'in_transit' && (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                        ✓ Colis prêt
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
