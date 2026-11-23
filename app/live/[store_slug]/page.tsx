import { createClient } from '@/lib/supabase/server'
import { DEFAULT_LOME_ZONES } from '@/lib/config/lome-zones'
import {
  PublicLiveCartClient,
  type PublicLiveStoreData,
} from './PublicLiveCartClient'

const PALETTE_HEX: Record<string, string> = {
  emerald: '#10B981',
  sky: '#0284C7',
  coral: '#F97316',
  violet: '#7C3AED',
  indigo: '#4F46E5',
  terracotta: '#C2410C',
}

export default async function PublicLiveStorePage({
  params,
}: {
  params: Promise<{ store_slug: string }>
}) {
  const { store_slug } = await params
  const supabase = await createClient()

  let storeData: PublicLiveStoreData = {
    companyId: store_slug,
    storeName: 'Boutique Live Kaba Kaba',
    logoUrl: null,
    paletteHex: '#10B981',
    products: [
      {
        id: 'demo-1',
        name: 'Robe Wax Royale',
        price_fcfa: 15000,
        stock_qty: 10,
        category: 'Vêtements',
      },
      {
        id: 'demo-2',
        name: 'Ensemble Bazin Riche',
        price_fcfa: 22000,
        stock_qty: 8,
        category: 'Tenues',
      },
    ],
    zones: DEFAULT_LOME_ZONES.map((z) => ({
      zone_name: z.zone_name,
      fee_fcfa: z.fee_fcfa,
    })),
  }

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'get_public_live_store_catalog',
    { p_slug: store_slug }
  )

  if (!rpcErr && rpcData) {
    const d = rpcData as Record<string, any>
    const palKey = String(d.palette_key || 'emerald')
    const dbProducts = Array.isArray(d.products) ? d.products : []
    const dbZones = Array.isArray(d.zones) ? d.zones : []

    storeData = {
      companyId: String(d.company_id || store_slug),
      storeName: String(d.store_name || 'Boutique Live'),
      logoUrl: d.logo_url || null,
      paletteHex: PALETTE_HEX[palKey] || '#10B981',
      products: dbProducts.length > 0 ? dbProducts : storeData.products,
      zones: dbZones.length > 0 ? dbZones : storeData.zones,
    }
  }

  return <PublicLiveCartClient store={storeData} />
}
