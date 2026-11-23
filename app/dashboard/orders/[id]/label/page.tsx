import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { PrintableOrderLabel } from './_components/PrintableOrderLabel'

const PALETTE_HEX: Record<string, string> = {
  emerald: '#10B981',
  sky: '#0284C7',
  coral: '#F97316',
  violet: '#7C3AED',
  indigo: '#4F46E5',
  terracotta: '#C2410C',
}

export default async function OrderLabelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  const { data: order } = await supabase
    .from('orders')
    .select(
      `
      id,
      parcel_number,
      status,
      total_amount,
      delivery_fee,
      customers(full_name, phone, city, address),
      order_items(product_name, quantity, unit_price)
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (!order) {
    redirect('/dashboard/orders')
  }

  const cust = Array.isArray(order.customers)
    ? order.customers[0]
    : order.customers
  const items = Array.isArray(order.order_items) ? order.order_items : []

  const orderNumber =
    (order as { parcel_number?: string | null }).parcel_number ||
    `#KK-${order.id.slice(0, 6).toUpperCase()}`
  const paletteKey = profile.companies?.theme_palette || 'emerald'
  const paletteHex = PALETTE_HEX[paletteKey] || '#10B981'

  return (
    <PrintableOrderLabel
      orderId={order.id}
      orderNumber={orderNumber}
      qrToken={order.id}
      barcodeValue={`KK-${order.id.replace(/-/g, '').slice(0, 10).toUpperCase()}`}
      status={order.status}
      totalCodFcfa={Math.round(Number(order.total_amount ?? 0))}
      deliveryFeeFcfa={Math.round(Number(order.delivery_fee ?? 0))}
      customerName={cust?.full_name || 'Client(e)'}
      customerPhone={cust?.phone || '+228'}
      customerAddress={
        [cust?.city, cust?.address].filter(Boolean).join(' — ') || 'Lomé'
      }
      itemsSummary={
        items.length > 0
          ? items.map(
              (it: { product_name: string; quantity: number }) =>
                `${it.quantity}x ${it.product_name}`
            )
          : ['Colis standard']
      }
      storeName={profile.companies?.name || 'Boutique Kaba Kaba'}
      storeLogoUrl={profile.companies?.logo_url ?? null}
      paletteHex={paletteHex}
    />
  )
}
