import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { getAnalyticsReport } from '@/app/actions/reports'
import DashboardLayout from '../_components/DashboardLayout'
import AnalyticsView from './_components/AnalyticsView'

export const metadata = { title: 'Analytics & Rapports — Élégance Wax Lomé' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.role === 'courier') {
    redirect('/mes-livraisons')
  }

  const { data } = await getAnalyticsReport('today')

  const fallbackReport = data ?? {
    period: 'today' as const,
    storeName: profile.companies?.name ?? 'Élégance Wax Lomé',
    generatedAt: new Date().toISOString(),
    kpis: {
      productSalesRevenue: 0,
      courierCommissionsPaid: 0,
      netShopCollected: 0,
      totalOrders: 0,
      deliveredOrders: 0,
      failedOrCancelledOrders: 0,
      deliverySuccessRate: 0,
    },
    topNeighborhoods: [],
    settlementLogs: [],
    journalRows: [],
  }

  return (
    <DashboardLayout
      userName={profile.full_name}
      companyName={profile.companies?.name ?? ''}
      userRole={profile.role}
      logoUrl={profile.companies?.logo_url ?? null}
      themePalette={profile.companies?.theme_palette ?? 'indigo'}
    >
      <AnalyticsView initialData={fallbackReport} />
    </DashboardLayout>
  )
}
