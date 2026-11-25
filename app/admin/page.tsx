import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { parsePlatformMaintenanceAndMerchants } from '@/lib/quotas'
import { AdminMetrics } from '@/app/super-admin/_components/AdminMetrics'
import type { SuperAdminStoreRow } from '@/app/super-admin/_components/StoresManagementTable'
import type { SubscriptionStatus } from '@/types/database.types'
import {
  SuperAdminControlView,
  type SubscriptionRequestItem,
  type SystemLogItem,
} from './_components/SuperAdminControlView'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const currentPage = Math.max(1, Number(params.page) || 1)
  const from = (currentPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()

  const isFounder =
    (user.email || '').trim().toLowerCase() === 'degbomedia@gmail.com'

  if (
    !isFounder &&
    profile?.role !== 'super_admin' &&
    profile?.role !== 'admin'
  ) {
    redirect('/dashboard?error=unauthorized')
  }

  if (isFounder && profile && profile.role !== 'super_admin') {
    await supabase
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', user.id)
  }

  const [
    platformRes,
    companiesRes,
    subscriptionsRes,
    profilesRes,
    ordersRes,
    requestsRes,
    storesRes,
    systemLogsRes,
  ] = await Promise.all([
    supabase.from('platform_settings').select('*').limit(1).maybeSingle(),
    supabase
      .from('companies')
      .select('id, name, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to),
    supabase
      .from('subscriptions')
      .select(
        'company_id, status, trial_ends_at, current_period_ends_at, monthly_price'
      ),
    supabase.from('profiles').select('company_id, full_name, phone, role'),
    supabase.from('orders').select('company_id'),
    supabase
      .from('subscription_requests')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('stores').select('id, store_name'),
    supabase
      .from('system_logs')
      .select('id, level, source, message, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const companies = companiesRes.data ?? []
  const totalStoresCount = companiesRes.count ?? companies.length
  const subscriptions = subscriptionsRes.data ?? []
  const profiles = profilesRes.data ?? []
  const orders = ordersRes.data ?? []
  const storeNameById = new Map(
    (storesRes.data ?? []).map((s: any) => [s.id, s.store_name])
  )

  const subByCompany = new Map<
    string,
    {
      status: SubscriptionStatus
      trial_ends_at: string | null
      current_period_ends_at: string | null
      monthly_price: number
    }
  >()
  for (const s of subscriptions) {
    subByCompany.set(s.company_id, {
      status: s.status as SubscriptionStatus,
      trial_ends_at: s.trial_ends_at,
      current_period_ends_at: s.current_period_ends_at,
      monthly_price: s.monthly_price ?? 10000,
    })
  }

  const ownerByCompany = new Map<
    string,
    { full_name: string; phone: string | null }
  >()
  for (const p of profiles) {
    const existing = ownerByCompany.get(p.company_id)
    if (!existing || p.role === 'owner' || p.role === 'seller') {
      ownerByCompany.set(p.company_id, {
        full_name: p.full_name,
        phone: p.phone,
      })
    }
  }

  const orderCountByCompany = new Map<string, number>()
  for (const o of orders) {
    orderCountByCompany.set(
      o.company_id,
      (orderCountByCompany.get(o.company_id) ?? 0) + 1
    )
  }

  const now = Date.now()
  let activeStores = 0
  let trialStores = 0
  let expiredStores = 0
  let mrrFcfa = 0

  const storeRows: SuperAdminStoreRow[] = companies.map((company) => {
    const sub = subByCompany.get(company.id)
    const owner = ownerByCompany.get(company.id)
    const status: SubscriptionStatus = sub?.status ?? 'trialing'
    const monthlyPrice = sub?.monthly_price ?? 10000
    const trialEndsAt = sub?.trial_ends_at ?? null
    const currentPeriodEndsAt = sub?.current_period_ends_at ?? null

    if (status === 'active') {
      activeStores += 1
      mrrFcfa += monthlyPrice
    } else if (
      status === 'trialing' &&
      (!trialEndsAt || new Date(trialEndsAt).getTime() >= now)
    ) {
      trialStores += 1
    } else {
      expiredStores += 1
    }

    return {
      id: company.id,
      name: company.name,
      createdAt: company.created_at,
      ownerName: owner?.full_name ?? 'Propriétaire',
      ownerPhone: owner?.phone ?? null,
      ordersCount: orderCountByCompany.get(company.id) ?? 0,
      status,
      trialEndsAt,
      currentPeriodEndsAt,
      monthlyPrice,
    }
  })

  const requestItems: SubscriptionRequestItem[] = (requestsRes.data ?? []).map(
    (r: any) => ({
      id: r.id,
      seller_id: r.seller_id,
      storeName: storeNameById.get(r.seller_id) || 'Boutique',
      requested_plan: r.requested_plan,
      mobile_money_ref: r.mobile_money_ref,
      phone: r.phone,
      status: r.status,
      created_at: r.created_at,
    })
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <header className="sticky top-0 z-30 bg-[#0B132B] text-white border-b border-[#1E293B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#10B981]/20 border border-[#10B981]/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-extrabold">
                {platformRes.data?.saas_name || 'Kaba Kaba'} — Super Admin (/admin)
              </p>
              <p className="text-xs text-[#94A3B8]">
                {profile.full_name || user.email}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#131C31] hover:bg-[#1E293B] border border-[#1E293B]"
          >
            <ArrowLeft className="w-4 h-4 text-[#10B981]" />
            <span>Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <AdminMetrics
          totalStores={totalStoresCount}
          activeStores={activeStores}
          trialStores={trialStores}
          expiredStores={expiredStores}
          mrrFcfa={mrrFcfa}
          totalOrders={orders.length}
        />

        <SuperAdminControlView
          initialSaasName={platformRes.data?.saas_name || 'Kaba Kaba'}
          initialSaasLogoUrl={platformRes.data?.saas_logo_url ?? null}
          initialFreeOrders={
            Number(platformRes.data?.free_mvp_max_orders_month) === 30
              ? 20
              : Number(platformRes.data?.free_mvp_max_orders_month) || 20
          }
          initialFreeDrivers={
            Number(platformRes.data?.free_mvp_max_drivers) || 1
          }
          initialFreeAiTrials={
            Number(platformRes.data?.free_mvp_max_ai_trials) || 3
          }
          initialProDrivers={Number(platformRes.data?.pro_max_drivers) || 3}
          initialMaintenanceMode={Boolean(
            platformRes.data?.is_maintenance_mode
          )}
          initialMaintenanceMessage={
            parsePlatformMaintenanceAndMerchants(
              platformRes.data as Record<string, unknown> | null
            ).cleanMaintenanceMessage
          }
          initialTmoneyPhone={
            parsePlatformMaintenanceAndMerchants(
              platformRes.data as Record<string, unknown> | null
            ).tmoneyPhone
          }
          initialFloozPhone={
            parsePlatformMaintenanceAndMerchants(
              platformRes.data as Record<string, unknown> | null
            ).floozPhone
          }
          initialSystemLogs={(systemLogsRes.data ?? []) as SystemLogItem[]}
          stores={storeRows}
          totalStoresCount={totalStoresCount}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          requests={requestItems}
        />
      </main>
    </div>
  )
}
