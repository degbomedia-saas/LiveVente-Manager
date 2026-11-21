import { createClient } from '@/lib/supabase/server'
import { AdminMetrics } from './_components/AdminMetrics'
import {
  StoresManagementTable,
  type SuperAdminStoreRow,
} from './_components/StoresManagementTable'
import type { SubscriptionStatus } from '@/types/database.types'

export const dynamic = 'force-dynamic'

export default async function SuperAdminPage() {
  const supabase = await createClient()

  const [companiesRes, subscriptionsRes, profilesRes, ordersRes] =
    await Promise.all([
      supabase
        .from('companies')
        .select('id, name, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('subscriptions')
        .select(
          'company_id, status, trial_ends_at, current_period_ends_at, monthly_price'
        ),
      supabase
        .from('profiles')
        .select('company_id, full_name, phone, role'),
      supabase.from('orders').select('company_id'),
    ])

  const companies = companiesRes.data ?? []
  const subscriptions = subscriptionsRes.data ?? []
  const profiles = profilesRes.data ?? []
  const orders = ordersRes.data ?? []

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
      monthly_price: s.monthly_price ?? 15000,
    })
  }

  const ownerByCompany = new Map<
    string,
    { full_name: string; phone: string | null }
  >()
  for (const p of profiles) {
    const existing = ownerByCompany.get(p.company_id)
    if (!existing || p.role === 'owner' || p.role === 'super_admin') {
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
    const monthlyPrice = sub?.monthly_price ?? 15000
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
      ownerName: owner?.full_name ?? 'Propriétaire inconnu',
      ownerPhone: owner?.phone ?? null,
      ordersCount: orderCountByCompany.get(company.id) ?? 0,
      status,
      trialEndsAt,
      currentPeriodEndsAt,
      monthlyPrice,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Kaba Kaba — Tour de Contrôle Fondateur
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Supervision globale des boutiques, des essais de 14 jours et des paiements T-Money / Moov.
        </p>
      </div>

      <AdminMetrics
        totalStores={companies.length}
        activeStores={activeStores}
        trialStores={trialStores}
        expiredStores={expiredStores}
        mrrFcfa={mrrFcfa}
        totalOrders={orders.length}
      />

      <StoresManagementTable stores={storeRows} />
    </div>
  )
}
