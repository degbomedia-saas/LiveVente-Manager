import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import DashboardLayout from '../_components/DashboardLayout'
import {
  ReturnsView,
  type ReturnOrderOption,
  type ReturnRowItem,
} from './_components/ReturnsView'

export const metadata = { title: 'Retours & Remise en Stock — Kaba Kaba' }

export default async function ReturnsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)

  const [{ data: orders }, { data: returnsData }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, parcel_number, customers(full_name)')
      .order('ordered_at', { ascending: false })
      .limit(50),
    supabase
      .from('returns')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const orderOptions: ReturnOrderOption[] = (orders ?? []).map((o) => {
    const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers
    return {
      id: o.id,
      orderNumber:
        (o as { parcel_number?: string | null }).parcel_number ||
        `#KK-${o.id.slice(0, 6).toUpperCase()}`,
      customerName: cust?.full_name || 'Client(e)',
    }
  })

  const orderMap = new Map(orderOptions.map((o) => [o.id, o]))

  const returnItems: ReturnRowItem[] = (returnsData ?? []).map((r: any) => {
    const ord = orderMap.get(r.order_id)
    return {
      id: r.id,
      order_id: r.order_id,
      orderNumber: ord?.orderNumber || '#KK',
      customerName: ord?.customerName || 'Client(e)',
      reason: r.reason,
      status: r.status,
      created_at: r.created_at,
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
      <ReturnsView initialReturns={returnItems} orders={orderOptions} />
    </DashboardLayout>
  )
}
