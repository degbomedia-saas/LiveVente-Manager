import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { parsePlatformMaintenanceAndMerchants } from '@/lib/quotas'
import { AdminMetrics } from '@/app/super-admin/_components/AdminMetrics'
import type {
  StorePreviewOrderItem,
  SuperAdminStoreRow,
} from '@/app/super-admin/_components/StoresManagementTable'
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
    supabase
      .from('orders')
      .select('id, company_id, parcel_number, status, total_amount, ordered_at')
      .order('ordered_at', { ascending: false }),
    supabase
      .from('subscription_requests')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('stores')
      .select(
        'id, company_id, store_name, whatsapp_phone, city, plan, plan_status'
      ),
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
  const storesData = storesRes.data ?? []

  const storeNameById = new Map<string, string>()
  const storeByCompanyId = new Map<
    string,
    {
      id: string
      store_name: string
      whatsapp_phone: string | null
      city: string | null
      plan: 'free_mvp' | 'pro' | 'business'
      plan_status: 'active' | 'trial' | 'suspended'
    }
  >()

  for (const s of storesData as Array<{
    id: string
    company_id?: string | null
    store_name: string
    whatsapp_phone?: string | null
    city?: string | null
    plan?: 'free_mvp' | 'pro' | 'business'
    plan_status?: 'active' | 'trial' | 'suspended'
  }>) {
    storeNameById.set(s.id, s.store_name)
    if (s.company_id) {
      storeByCompanyId.set(s.company_id, {
        id: s.id,
        store_name: s.store_name,
        whatsapp_phone: s.whatsapp_phone ?? null,
        city: s.city ?? null,
        plan: s.plan ?? 'free_mvp',
        plan_status: s.plan_status ?? 'trial',
      })
    }
  }

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
      monthly_price: s.monthly_price ?? 5000,
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

  const orderStatsByCompany = new Map<
    string,
    {
      count: number
      revenueFcfa: number
      deliveredCount: number
      pendingCount: number
      recentOrders: StorePreviewOrderItem[]
    }
  >()

  for (const o of orders as Array<{
    id: string
    company_id: string
    parcel_number?: string | null
    status?: string | null
    total_amount?: number | null
    ordered_at?: string | null
  }>) {
    const current = orderStatsByCompany.get(o.company_id) ?? {
      count: 0,
      revenueFcfa: 0,
      deliveredCount: 0,
      pendingCount: 0,
      recentOrders: [],
    }
    const status = o.status || 'pending'
    const amount = Number(o.total_amount ?? 0)
    if (status !== 'cancelled') {
      current.count += 1
      current.revenueFcfa += amount
    }
    if (status === 'delivered') {
      current.deliveredCount += 1
    } else if (status !== 'cancelled') {
      current.pendingCount += 1
    }
    if (current.recentOrders.length < 6) {
      current.recentOrders.push({
        id: o.id,
        numberLabel: o.parcel_number || `#KK-${o.id.slice(0, 4).toUpperCase()}`,
        amountFcfa: amount,
        status,
        orderedAt: o.ordered_at || new Date().toISOString(),
      })
    }
    orderStatsByCompany.set(o.company_id, current)
  }

  const freeOrdersLimit =
    Number(platformRes.data?.free_mvp_max_orders_month) === 30
      ? 20
      : Number(platformRes.data?.free_mvp_max_orders_month) || 20

  const now = Date.now()
  let activeStores = 0
  let trialStores = 0
  let expiredStores = 0
  let mrrFcfa = 0

  const storeRows: SuperAdminStoreRow[] = companies.map((company) => {
    const sub = subByCompany.get(company.id)
    const storeRow = storeByCompanyId.get(company.id)
    const owner = ownerByCompany.get(company.id)
    const ordStats = orderStatsByCompany.get(company.id)

    const planCode =
      storeRow?.plan === 'business'
        ? 'business'
        : storeRow?.plan === 'pro' || sub?.status === 'active'
          ? 'pro'
          : 'free_mvp'

    const monthlyPrice =
      planCode === 'business'
        ? 25000
        : sub?.monthly_price === 15000
          ? 15000
          : 5000

    let status: SubscriptionStatus = sub?.status ?? 'trialing'
    if (storeRow?.plan_status === 'suspended') {
      status = 'expired'
    } else if (
      storeRow?.plan === 'pro' ||
      storeRow?.plan === 'business' ||
      sub?.status === 'active'
    ) {
      status = 'active'
    }

    const trialEndsAt = sub?.trial_ends_at ?? null
    const currentPeriodEndsAt = sub?.current_period_ends_at ?? null

    if (status === 'active') {
      activeStores += 1
      mrrFcfa += monthlyPrice === 15000 ? 5000 : monthlyPrice
    } else if (
      status === 'trialing' &&
      (!trialEndsAt || new Date(trialEndsAt).getTime() >= now)
    ) {
      trialStores += 1
    } else {
      expiredStores += 1
    }

    const planLabel =
      status === 'active'
        ? planCode === 'business'
          ? 'Actif — Plan Business 25 000 F/m'
          : monthlyPrice === 15000
            ? 'Actif — Plan Trimestriel 15 000 F/3m'
            : 'Actif — Plan Solo 5 000 F/m'
        : status === 'trialing'
          ? 'Essai — Plan Découverte 0 F'
          : planCode === 'business'
            ? 'Suspendu — Plan Business 25 000 F/m'
            : 'Suspendu — Plan Solo 5 000 F/m'

    return {
      id: company.id,
      name: storeRow?.store_name || company.name,
      createdAt: company.created_at,
      ownerName: owner?.full_name ?? 'Propriétaire',
      ownerPhone: owner?.phone || storeRow?.whatsapp_phone || null,
      city: storeRow?.city || 'Lomé',
      ordersCount: ordStats?.count ?? 0,
      freeOrdersLimit,
      status,
      planCode,
      planLabel,
      trialEndsAt,
      currentPeriodEndsAt,
      monthlyPrice,
      totalRevenueFcfa: ordStats?.revenueFcfa ?? 0,
      deliveredOrdersCount: ordStats?.deliveredCount ?? 0,
      pendingOrdersCount: ordStats?.pendingCount ?? 0,
      recentOrders: ordStats?.recentOrders ?? [],
    }
  })

  const requestItems: SubscriptionRequestItem[] = (requestsRes.data ?? []).map(
    (r: {
      id: string
      seller_id: string
      requested_plan: 'free_mvp' | 'pro' | 'business'
      mobile_money_ref: string
      phone: string
      status: 'pending' | 'approved' | 'rejected'
      created_at: string
    }) => ({
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

  const parsedPlatform = parsePlatformMaintenanceAndMerchants(
    platformRes.data as Record<string, unknown> | null
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
                {platformRes.data?.saas_name || 'Kaba Kaba'} — Direction &amp;
                Abonnements
              </p>
              <p className="text-xs text-[#94A3B8]">
                {profile?.full_name || user.email}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#131C31] hover:bg-[#1E293B] border border-[#1E293B]"
          >
            <ArrowLeft className="w-4 h-4 text-[#10B981]" />
            <span>Tableau de bord</span>
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
          initialFreeOrders={freeOrdersLimit}
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
          initialMaintenanceMessage={parsedPlatform.cleanMaintenanceMessage}
          initialTmoneyPhone={parsedPlatform.tmoneyPhone}
          initialFloozPhone={parsedPlatform.floozPhone}
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
