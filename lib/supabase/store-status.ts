import type { SupabaseClient } from '@supabase/supabase-js'

export interface StorePlanState {
  storeId: string | null
  plan: 'free_mvp' | 'pro' | 'business'
  planStatus: 'active' | 'trial' | 'suspended'
  isSuspended: boolean
}

export async function getStorePlanState(
  supabase: SupabaseClient,
  userId: string,
  companyId?: string | null
): Promise<StorePlanState> {
  try {
    let query = supabase
      .from('stores')
      .select('id, plan, plan_status')
      .limit(1)

    if (companyId) {
      query = query.or(`owner_id.eq.${userId},company_id.eq.${companyId}`)
    } else {
      query = query.eq('owner_id', userId)
    }

    const { data: store } = await query.maybeSingle()

    const plan =
      store?.plan === 'pro' || store?.plan === 'business'
        ? store.plan
        : 'free_mvp'
    const planStatus =
      store?.plan_status === 'suspended'
        ? 'suspended'
        : store?.plan_status === 'active'
          ? 'active'
          : 'trial'

    return {
      storeId: store?.id ?? null,
      plan,
      planStatus,
      isSuspended: planStatus === 'suspended',
    }
  } catch {
    return {
      storeId: null,
      plan: 'free_mvp',
      planStatus: 'trial',
      isSuspended: false,
    }
  }
}

export async function assertStoreNotSuspended(
  supabase: SupabaseClient,
  userId: string,
  companyId?: string | null
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const state = await getStorePlanState(supabase, userId, companyId)
  if (state.isSuspended) {
    return {
      allowed: false,
      error:
        'Abonnement suspendu : vos données restent consultables, mais les créations et modifications sont bloquées. Renouvelez par T-Money / Flooz.',
    }
  }
  return { allowed: true }
}
