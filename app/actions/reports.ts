'use server'

import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'

export type AnalyticsPeriod = 'today' | 'week' | 'month'

export interface NeighborhoodStatRow {
  zone: string
  ordersCount: number
  revenue: number
  percentage: number
}

export interface SettlementLogRow {
  id: string
  paidAt: string
  courierName: string
  deliveredCount: number
  amount: number
  differenceAmount: number
  differenceReason: string | null
  notes: string | null
}

export interface CashJournalExportRow {
  date: string
  orderRef: string
  clientName: string
  clientPhone: string
  neighborhood: string
  saleAmount: number
  deliveryFee: number
  courierName: string
  statusLabel: string
  paymentMethod: string
}

export interface AnalyticsReportData {
  period: AnalyticsPeriod
  storeName: string
  generatedAt: string
  kpis: {
    productSalesRevenue: number
    courierCommissionsPaid: number
    netShopCollected: number
    totalOrders: number
    deliveredOrders: number
    failedOrCancelledOrders: number
    deliverySuccessRate: number
  }
  topNeighborhoods: NeighborhoodStatRow[]
  settlementLogs: SettlementLogRow[]
  journalRows: CashJournalExportRow[]
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'À confirmer',
  pending: 'En attente',
  confirmed: 'Confirmée',
  packed: 'Emballée',
  assigned: 'Attribuée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  in_transit: 'En cours',
  delivered: 'Livrée',
  cancelled: 'Annulée / Échec',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  card: 'Carte',
  bank_transfer: 'Virement',
}

function getPeriodStartIso(period: AnalyticsPeriod): string {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return start.toISOString()
  }
  if (period === 'week') {
    const day = now.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0)
    return start.toISOString()
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return start.toISOString()
}

export async function getAnalyticsReport(
  period: AnalyticsPeriod = 'today'
): Promise<{ data?: AnalyticsReportData; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil entreprise introuvable.' }
  }

  if (profile.role === 'courier') {
    return { error: 'Accès non autorisé.' }
  }

  const companyId = profile.company_id
  const startIso = getPeriodStartIso(period)

  const [
    { data: ordersData },
    { data: settlementsData },
    { data: couriersData },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select(`
        id,
        parcel_number,
        status,
        total_amount,
        delivery_fee,
        ordered_at,
        created_at,
        customers(full_name, phone, city, address),
        deliveries(id, status, courier_id, profiles(full_name)),
        payments(id, amount, method, status, reference, paid_at)
      `)
      .eq('company_id', companyId)
      .gte('ordered_at', startIso)
      .order('ordered_at', { ascending: false }),
    supabase
      .from('courier_settlements')
      .select('id, courier_id, amount, deliveries_count, paid_at, created_at, notes, difference_amount, difference_reason')
      .eq('company_id', companyId)
      .eq('status', 'paid')
      .gte('created_at', startIso)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('role', 'courier'),
  ])

  const courierNameById = new Map<string, string>()
  for (const c of couriersData ?? []) {
    courierNameById.set(c.id, c.full_name)
  }

  const orders = ordersData ?? []
  let productSalesRevenue = 0
  let courierCommissionsPaid = 0
  let directShopPayments = 0
  let deliveredOrders = 0
  let failedOrCancelledOrders = 0

  const zoneMap = new Map<string, { ordersCount: number; revenue: number }>()
  const deliveredCountByCourier = new Map<string, number>()
  const journalRows: CashJournalExportRow[] = []

  for (const ord of orders as any[]) {
    const totalAmt = Number(ord.total_amount ?? 0)
    const fee = Number(ord.delivery_fee ?? 0)
    const isCancelled = ord.status === 'cancelled'
    const delObj = Array.isArray(ord.deliveries) ? ord.deliveries[0] : ord.deliveries
    const isDelivered = ord.status === 'delivered' || delObj?.status === 'delivered'
    const isFailed = isCancelled || delObj?.status === 'failed'

    if (isDelivered) {
      deliveredOrders++
      courierCommissionsPaid += fee
      if (delObj?.courier_id) {
        deliveredCountByCourier.set(
          delObj.courier_id,
          (deliveredCountByCourier.get(delObj.courier_id) ?? 0) + 1
        )
      }
    } else if (isFailed) {
      failedOrCancelledOrders++
    }

    if (!isCancelled) {
      productSalesRevenue += Math.max(0, totalAmt - fee)
    }

    // Paiements directs comptoir boutique
    const paymentsList: any[] = ord.payments ?? []
    const completedPayments = paymentsList.filter((p) => p.status === 'completed')
    for (const p of completedPayments) {
      const ref = String(p.reference ?? '').toLowerCase()
      const isCourierPayment =
        ref.startsWith('livreur') ||
        ref.includes('encaissé par livreur') ||
        ref.includes('encaisse par livreur') ||
        ref.includes('livraison —')
      if (!isCourierPayment) {
        directShopPayments += Number(p.amount ?? 0)
      }
    }

    // Quartier
    const cust = Array.isArray(ord.customers) ? ord.customers[0] : ord.customers
    const rawZone = (cust?.city || cust?.address || 'Non précisé').trim()
    const zoneKey = rawZone || 'Non précisé'
    const existingZone = zoneMap.get(zoneKey) ?? { ordersCount: 0, revenue: 0 }
    existingZone.ordersCount += 1
    if (!isCancelled) {
      existingZone.revenue += totalAmt
    }
    zoneMap.set(zoneKey, existingZone)

    // Ligne d'export CSV
    const courierProfile = delObj?.profiles
    const courierName =
      (Array.isArray(courierProfile) ? courierProfile[0]?.full_name : courierProfile?.full_name) ||
      (delObj?.courier_id ? courierNameById.get(delObj.courier_id) : null) ||
      'Non assigné'

    const primaryPayment = completedPayments[0]
    const paymentModeLabel = primaryPayment
      ? PAYMENT_METHOD_LABELS[primaryPayment.method] || primaryPayment.method || 'Espèces'
      : 'À la livraison'

    const orderDate = ord.ordered_at || ord.created_at
    journalRows.push({
      date: new Date(orderDate).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      orderRef: ord.parcel_number
        ? `Colis ${ord.parcel_number}`
        : `#${String(ord.id).slice(0, 6).toUpperCase()}`,
      clientName: cust?.full_name || 'Client',
      clientPhone: cust?.phone || '',
      neighborhood: zoneKey,
      saleAmount: Math.max(0, totalAmt - fee),
      deliveryFee: fee,
      courierName,
      statusLabel: ORDER_STATUS_LABELS[ord.status] || ord.status,
      paymentMethod: paymentModeLabel,
    })
  }

  const settlements = settlementsData ?? []
  const settledTotal = settlements.reduce((sum, s: any) => sum + Number(s.amount ?? 0), 0)
  const netShopCollected = directShopPayments + settledTotal

  const totalOrders = orders.length
  const completedAttempts = deliveredOrders + failedOrCancelledOrders
  const deliverySuccessRate =
    completedAttempts > 0
      ? Math.round((deliveredOrders / completedAttempts) * 100)
      : totalOrders > 0
      ? Math.round((deliveredOrders / totalOrders) * 100)
      : 0

  // Top 5 quartiers
  const sortedZones = Array.from(zoneMap.entries())
    .sort((a, b) => b[1].ordersCount - a[1].ordersCount)
    .slice(0, 5)

  const topNeighborhoods: NeighborhoodStatRow[] = sortedZones.map(([zone, stat]) => ({
    zone,
    ordersCount: stat.ordersCount,
    revenue: stat.revenue,
    percentage: totalOrders > 0 ? Math.round((stat.ordersCount / totalOrders) * 100) : 0,
  }))

  const settlementLogs: SettlementLogRow[] = settlements.map((s: any) => ({
    id: s.id,
    paidAt: s.paid_at || s.created_at,
    courierName: courierNameById.get(s.courier_id) ?? 'Livreur',
    deliveredCount:
      Number(s.deliveries_count ?? 0) > 0
        ? Number(s.deliveries_count)
        : deliveredCountByCourier.get(s.courier_id) ?? 0,
    amount: Number(s.amount ?? 0),
    differenceAmount: Number(s.difference_amount ?? 0),
    differenceReason: s.difference_reason ?? null,
    notes: s.notes ?? null,
  }))

  return {
    data: {
      period,
      storeName: profile.companies?.name?.trim() || 'Élégance Wax Lomé',
      generatedAt: new Date().toISOString(),
      kpis: {
        productSalesRevenue,
        courierCommissionsPaid,
        netShopCollected,
        totalOrders,
        deliveredOrders,
        failedOrCancelledOrders,
        deliverySuccessRate,
      },
      topNeighborhoods,
      settlementLogs,
      journalRows,
    },
  }
}
