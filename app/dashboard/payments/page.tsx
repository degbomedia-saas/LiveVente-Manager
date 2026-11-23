import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import PaymentsView, {
  type CourierBalanceRow,
  type SettlementHistoryRow,
  type ShopFinancialSummary,
  type ReturnedDeliveryRow,
} from './_components/PaymentsView'

export const metadata = { title: 'Paiements — Élégance Wax Lomé' }

interface DeliveredQueryRow {
  id: string
  courier_id: string
  order_id: string
  delivered_at: string | null
  created_at: string
  orders: {
    total_amount: number
    delivery_fee: number
  } | null
}

export default async function PaymentsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') {
    redirect('/mes-livraisons')
  }

  if (profile.role === 'employee') {
    redirect('/dashboard/orders')
  }

  const [
    { data: couriers },
    { data: deliveredRows },
    { data: paymentRows },
    { data: settlementRows },
    { data: assignedRows },
    { data: failedRows },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, phone, is_active')
      .eq('role', 'courier')
      .order('full_name', { ascending: true }),
    supabase
      .from('deliveries')
      .select('id, courier_id, order_id, delivered_at, created_at, orders(total_amount, delivery_fee)')
      .eq('status', 'delivered'),
    supabase
      .from('payments')
      .select('id, order_id, amount, method, status, reference, paid_at')
      .eq('status', 'completed'),
    supabase
      .from('courier_settlements')
      .select('id, courier_id, amount, paid_at, created_at, notes, difference_amount, difference_reason')
      .eq('status', 'paid')
      .order('created_at', { ascending: false }),
    supabase
      .from('deliveries')
      .select('courier_id, status'),
    supabase
      .from('deliveries')
      .select('id, courier_id, order_id, failed_reason, notes, updated_at, orders(id, parcel_number, total_amount, customers(full_name), order_items(product_name, quantity))')
      .eq('status', 'failed')
      .order('updated_at', { ascending: false }),
  ])

  // Séparation stricte : Paiements perçus par la boutique vs Encaissés terrain par les livreurs
  let directShopReceived = 0
  const courierPaymentsByOrder = new Map<string, number>()

  for (const p of paymentRows ?? []) {
    const ref = (p.reference ?? '').toLowerCase()
    // Détection robuste des paiements terrain (migration 007: "Livreur: ...", migration 009: "Livraison — Encaissé par livreur...")
    const isCourierPayment =
      ref.startsWith('livreur') ||
      ref.includes('encaissé par livreur') ||
      ref.includes('encaisse par livreur') ||
      ref.includes('livraison —')

    const amt = Number(p.amount)
    if (isCourierPayment) {
      courierPaymentsByOrder.set(
        p.order_id,
        (courierPaymentsByOrder.get(p.order_id) ?? 0) + amt
      )
    } else {
      directShopReceived += amt
    }
  }

  interface CourierDeliveryItem {
    orderId: string
    deliveryDate: string
    deliveryFee: number
    collectedAmount: number
    netDue: number
  }

  const assignedByCourier = new Map<string, number>()
  for (const a of assignedRows ?? []) {
    assignedByCourier.set(a.courier_id, (assignedByCourier.get(a.courier_id) ?? 0) + 1)
  }

  const deliveriesByCourier = new Map<string, CourierDeliveryItem[]>()
  for (const d of (deliveredRows ?? []) as unknown as DeliveredQueryRow[]) {
    if (!deliveriesByCourier.has(d.courier_id)) {
      deliveriesByCourier.set(d.courier_id, [])
    }
    const collected = courierPaymentsByOrder.get(d.order_id) ?? 0
    const fee = Number(d.orders?.delivery_fee ?? 0)
    const netDue = Math.max(0, collected - fee)
    const deliveryDate = d.delivered_at || d.created_at

    deliveriesByCourier.get(d.courier_id)!.push({
      orderId: d.order_id,
      deliveryDate,
      deliveryFee: fee,
      collectedAmount: collected,
      netDue,
    })
  }

  // Regroupement des règlements effectués par livreur (avec date la plus récente)
  const settlementsByCourier = new Map<string, { total: number; latestPaidAt: string | null }>()
  for (const s of settlementRows ?? []) {
    const existing = settlementsByCourier.get(s.courier_id) ?? { total: 0, latestPaidAt: null }
    const paidDate = s.paid_at || s.created_at
    const latest = !existing.latestPaidAt || new Date(paidDate) > new Date(existing.latestPaidAt)
      ? paidDate
      : existing.latestPaidAt

    settlementsByCourier.set(s.courier_id, {
      total: existing.total + Number(s.amount),
      latestPaidAt: latest,
    })
  }

  let totalCourierCollectedGlobal = 0
  let totalDeliveryFeesGlobal = 0
  let totalExpectedSettlementGlobal = 0
  let totalRemainingGlobal = 0

  const courierNameMap = new Map<string, string>()
  const balances: CourierBalanceRow[] = (couriers ?? []).map((c) => {
    courierNameMap.set(c.id, c.full_name)
    const courierDeliveries = deliveriesByCourier.get(c.id) ?? []
    
    let totalCollected = 0
    let totalDeliveryFees = 0
    let totalExpected = 0

    for (const item of courierDeliveries) {
      totalCollected += item.collectedAmount
      totalDeliveryFees += item.deliveryFee
      totalExpected += item.netDue
    }

    const settlementInfo = settlementsByCourier.get(c.id)
    const totalSettled = settlementInfo?.total ?? 0

    // Détermination intelligente du solde restant dû :
    // 1. Calcul cumulatif standard : totalExpected - totalSettled
    let remainingBalance = Math.max(0, totalExpected - totalSettled)
    let overpaidAmount = totalSettled > totalExpected ? totalSettled - totalExpected : 0

    // 2. Gestion de l'asymétrie temporelle :
    // Si un ancien versement global (ex: 11 000 FCFA issu de tests passés) dépasse les courses de la session en base,
    // mais que le livreur a livré de NOUVELLES courses APRES la date du dernier règlement,
    // ces nouvelles courses ne doivent JAMAIS être artificiellement masquées ou effacées par un ancien test !
    if (settlementInfo?.latestPaidAt) {
      const latestSettlementTime = new Date(settlementInfo.latestPaidAt).getTime()
      const postSettlementDue = courierDeliveries
        .filter((d) => new Date(d.deliveryDate).getTime() > latestSettlementTime)
        .reduce((sum, d) => sum + d.netDue, 0)

      if (postSettlementDue > 0 && remainingBalance < postSettlementDue) {
        // Le livreur a de nouvelles courses dues après son dernier versement acté
        remainingBalance = postSettlementDue
        overpaidAmount = 0
      }
    }

    totalCourierCollectedGlobal += totalCollected
    totalDeliveryFeesGlobal += totalDeliveryFees
    totalExpectedSettlementGlobal += totalExpected
    totalRemainingGlobal += remainingBalance

    return {
      courierId: c.id,
      fullName: c.full_name,
      phone: c.phone,
      isActive: c.is_active,
      deliveredCount: courierDeliveries.length,
      assignedCount: assignedByCourier.get(c.id) ?? courierDeliveries.length,
      totalCollected,
      totalDeliveryFees,
      totalExpected,
      totalSettled,
      remainingBalance,
      overpaidAmount,
    }
  })

  const totalCourierSettledGlobal = (settlementRows ?? []).reduce(
    (sum, s) => sum + Number(s.amount),
    0
  )

  const summary: ShopFinancialSummary = {
    directShopReceived,
    totalCourierCollected: totalCourierCollectedGlobal,
    totalDeliveryFeesDue: totalDeliveryFeesGlobal,
    totalCourierExpectedSettlement: totalExpectedSettlementGlobal,
    totalCourierSettled: totalCourierSettledGlobal,
    remainingCourierSettlement: totalRemainingGlobal,
  }

  const history: SettlementHistoryRow[] = (settlementRows ?? []).map((s) => ({
    id: s.id,
    courierName: courierNameMap.get(s.courier_id) ?? 'Livreur',
    amount: Number(s.amount),
    paidAt: s.paid_at ?? s.created_at,
    notes: s.notes,
    differenceAmount: Number(s.difference_amount ?? 0),
    differenceReason: s.difference_reason ?? null,
  }))

  const returnedDeliveries: ReturnedDeliveryRow[] = (failedRows ?? []).map((f: any) => {
    const ord = Array.isArray(f.orders) ? f.orders[0] : f.orders
    const cust = ord ? (Array.isArray(ord.customers) ? ord.customers[0] : ord.customers) : null
    const items = (ord?.order_items ?? []) as Array<{ product_name: string; quantity: number }>
    return {
      deliveryId: f.id,
      courierName: courierNameMap.get(f.courier_id) ?? 'Livreur',
      parcelNumber: ord?.parcel_number || `#${String(f.order_id || '').slice(0, 6).toUpperCase()}`,
      clientName: cust?.full_name || 'Client',
      failedReason: f.failed_reason || 'Échec de livraison',
      items,
      isRestocked: Boolean((f.notes || '').includes('[STOCK RÉINTÉGRÉ]')),
    }
  })

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'indigo'}
    >
      <PaymentsView
        initialBalances={balances}
        initialHistory={history}
        initialSummary={summary}
        initialReturnedDeliveries={returnedDeliveries}
        userRole={profile.role}
      />
    </DashboardLayout>
  )
}
