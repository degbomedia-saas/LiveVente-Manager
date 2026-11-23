import { createClient } from '@/lib/supabase/server'
import {
  PublicTrackingClient,
  type PublicTrackingData,
} from './PublicTrackingClient'

const PALETTE_HEX: Record<string, string> = {
  emerald: '#10B981',
  sky: '#0284C7',
  coral: '#F97316',
  violet: '#7C3AED',
  indigo: '#4F46E5',
  terracotta: '#C2410C',
}

export default async function PublicTrackingPage({
  params,
}: {
  params: Promise<{ qr_token: string }>
}) {
  const { qr_token } = await params
  const supabase = await createClient()

  let trackingData: PublicTrackingData = {
    token: qr_token,
    orderNumber: `#KK-${qr_token.slice(0, 6).toUpperCase()}`,
    status: 'in_delivery',
    totalAmount: 15000,
    storeName: 'Boutique Kaba Kaba',
    storeLogoUrl: null,
    paletteHex: '#10B981',
    customerName: 'Client(e)',
    loyaltyPoints: 1,
    loyaltyThreshold: 5,
    alreadyConfirmed: false,
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'get_public_tracking_by_token',
    { p_token: qr_token }
  )

  if (!rpcErr && rpcData) {
    const d = rpcData as Record<string, any>
    const palKey = String(d.palette_key || 'emerald')
    trackingData = {
      token: qr_token,
      orderNumber: String(d.order_number || trackingData.orderNumber),
      status: String(d.status || 'in_delivery'),
      totalAmount: Number(d.total_amount ?? 15000),
      storeName: String(d.store_name || 'Boutique Kaba Kaba'),
      storeLogoUrl: d.store_logo || null,
      paletteHex: PALETTE_HEX[palKey] || '#10B981',
      customerName: String(d.customer_name || 'Client(e)'),
      loyaltyPoints: Number(d.loyalty_points ?? 1),
      loyaltyThreshold: Number(d.loyalty_threshold ?? 5),
      alreadyConfirmed: Boolean(d.customer_confirmed_at),
    }
  }

  return <PublicTrackingClient data={trackingData} />
}
