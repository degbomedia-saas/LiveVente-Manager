import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import {
  FinancesView,
  type FinanceOrderItem,
  type SettlementRowItem,
} from './_components/FinancesView'

export const metadata = { title: 'Finances & Rapprochement COD — Kaba Kaba' }

export default async function FinancesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.role === 'courier' || profile.role === 'driver') {
    redirect('/driver')
  }

  // Rôle employee : aucun accès aux finances ni aux rapprochements
  if (profile.role === 'employee') {
    redirect('/dashboard/orders')
  }

  const [{ data: orders }, { data: payments }, { data: settlements }] =
    await Promise.all([
      supabase
        .from('orders')
        .select(
          'id, parcel_number, status, total_amount, delivery_fee, ordered_at, customers(full_name)'
        )
        .order('ordered_at', { ascending: false }),
      supabase
        .from('payments')
        .select('order_id, amount, reference, status')
        .eq('status', 'completed'),
      supabase
        .from('settlements')
        .select('*')
        .order('created_at', { ascending: false }),
    ])

  // Calcul des acomptes payés directement à la boutique par commande
  const shopDepositsByOrder = new Map<string, number>()
  for (const p of payments ?? []) {
    const ref = (p.reference ?? '').toLowerCase()
    const isCourierCollected =
      ref.startsWith('livreur') ||
      ref.includes('encaissé par livreur') ||
      ref.includes('encaisse par livreur') ||
      ref.includes('livraison —')

    if (!isCourierCollected && p.order_id) {
      shopDepositsByOrder.set(
        p.order_id,
        (shopDepositsByOrder.get(p.order_id) ?? 0) + Math.round(Number(p.amount ?? 0))
      )
    }
  }

  const orderItems: FinanceOrderItem[] = (orders ?? []).map((o) => {
    const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers
    const totalOrder = Math.round(Number(o.total_amount ?? 0))
    const deliveryFee = Math.round(Number(o.delivery_fee ?? 0))
    const depositShop = Math.min(totalOrder, shopDepositsByOrder.get(o.id) ?? 0)
    // Solde que le livreur encaisse pour la boutique (hors acompte boutique et hors frais de course)
    const driverCollectedForStore = Math.max(
      0,
      totalOrder - depositShop - deliveryFee
    )

    return {
      id: o.id,
      orderNumber:
        (o as { parcel_number?: string | null }).parcel_number ||
        `#KK-${o.id.slice(0, 6).toUpperCase()}`,
      customerName: cust?.full_name || 'Client(e)',
      totalOrderFcfa: totalOrder,
      depositShopFcfa: depositShop,
      driverCollectedForStoreFcfa: driverCollectedForStore,
      deliveryFeeFcfa: deliveryFee,
      paymentMethod: depositShop > 0 ? 'Acompte Boutique + Solde COD' : 'COD',
      status: o.status,
      orderedAt: o.ordered_at,
    }
  })

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? 'Ma Boutique'}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'emerald'}
    >
      <FinancesView
        orders={orderItems}
        settlements={(settlements ?? []) as SettlementRowItem[]}
      />
    </DashboardLayout>
  )
}
