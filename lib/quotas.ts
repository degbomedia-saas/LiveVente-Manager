import type { SupabaseClient } from '@supabase/supabase-js'

export interface PlanQuotasConfig {
  free_mvp_max_orders_month: number
  free_mvp_max_drivers: number
  free_mvp_max_ai_trials: number
  pro_max_drivers: number
}

export const DEFAULT_PLAN_QUOTAS: PlanQuotasConfig = {
  free_mvp_max_orders_month: 30,
  free_mvp_max_drivers: 1,
  free_mvp_max_ai_trials: 3,
  pro_max_drivers: 3,
}

export async function getPlatformQuotas(
  supabase: SupabaseClient
): Promise<PlanQuotasConfig> {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select(
        'free_mvp_max_orders_month, free_mvp_max_drivers, free_mvp_max_ai_trials, pro_max_drivers'
      )
      .limit(1)
      .maybeSingle()

    if (!data) return DEFAULT_PLAN_QUOTAS
    return {
      free_mvp_max_orders_month:
        Number(data.free_mvp_max_orders_month) ||
        DEFAULT_PLAN_QUOTAS.free_mvp_max_orders_month,
      free_mvp_max_drivers:
        Number(data.free_mvp_max_drivers) ||
        DEFAULT_PLAN_QUOTAS.free_mvp_max_drivers,
      free_mvp_max_ai_trials:
        Number(data.free_mvp_max_ai_trials) ||
        DEFAULT_PLAN_QUOTAS.free_mvp_max_ai_trials,
      pro_max_drivers:
        Number(data.pro_max_drivers) || DEFAULT_PLAN_QUOTAS.pro_max_drivers,
    }
  } catch {
    return DEFAULT_PLAN_QUOTAS
  }
}

export async function getEffectiveSellerPlan(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<{
  plan: 'free_mvp' | 'pro' | 'business'
  aiTrialsUsed: number
  storeId: string | null
}> {
  const [{ data: store }, { data: sub }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, plan, ai_trials_used')
      .eq('owner_id', userId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('company_id', companyId)
      .maybeSingle(),
  ])

  let plan: 'free_mvp' | 'pro' | 'business' = 'free_mvp'
  if (store?.plan === 'business' || sub?.plan_type === 'enterprise') {
    plan = 'business'
  } else if (
    store?.plan === 'pro' ||
    sub?.plan_type === 'pro' ||
    sub?.plan_type === 'starter' ||
    sub?.status === 'active'
  ) {
    plan = 'pro'
  }

  return {
    plan,
    aiTrialsUsed: Number(store?.ai_trials_used ?? 0),
    storeId: store?.id ?? null,
  }
}

export async function checkAndConsumeAiQuota(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<{ allowed: boolean; quotaReached?: boolean; message?: string }> {
  const [{ plan, aiTrialsUsed, storeId }, quotas] = await Promise.all([
    getEffectiveSellerPlan(supabase, userId, companyId),
    getPlatformQuotas(supabase),
  ])

  if (plan === 'pro' || plan === 'business') {
    return { allowed: true }
  }

  if (aiTrialsUsed >= quotas.free_mvp_max_ai_trials) {
    return {
      allowed: false,
      quotaReached: true,
      message: `Quota gratuit atteint (${quotas.free_mvp_max_ai_trials}/${quotas.free_mvp_max_ai_trials} essais IA audio/texte). Passez au forfait Pro (10 000 F/mois via T-Money / Flooz) pour débloquer l'IA illimitée.`,
    }
  }

  if (storeId) {
    await supabase
      .from('stores')
      .update({ ai_trials_used: aiTrialsUsed + 1 })
      .eq('id', storeId)
  }

  return { allowed: true }
}

export async function checkOrderMonthlyQuota(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<{ allowed: boolean; quotaReached?: boolean; message?: string }> {
  const [{ plan }, quotas] = await Promise.all([
    getEffectiveSellerPlan(supabase, userId, companyId),
    getPlatformQuotas(supabase),
  ])

  if (plan === 'pro' || plan === 'business') {
    return { allowed: true }
  }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('ordered_at', startOfMonth.toISOString())

  if ((count ?? 0) >= quotas.free_mvp_max_orders_month) {
    return {
      allowed: false,
      quotaReached: true,
      message: `Quota gratuit atteint (${quotas.free_mvp_max_orders_month} commandes/mois sur le forfait MVP Gratuit). Activez la formule Pro via T-Money / Flooz pour des commandes illimitées.`,
    }
  }

  return { allowed: true }
}

export async function checkDriverQuota(
  supabase: SupabaseClient,
  userId: string,
  companyId: string
): Promise<{ allowed: boolean; quotaReached?: boolean; message?: string }> {
  const [{ plan }, quotas] = await Promise.all([
    getEffectiveSellerPlan(supabase, userId, companyId),
    getPlatformQuotas(supabase),
  ])

  if (plan === 'business') {
    return { allowed: true }
  }

  const maxDrivers =
    plan === 'pro' ? quotas.pro_max_drivers : quotas.free_mvp_max_drivers

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role', 'courier')
    .eq('is_active', true)

  if ((count ?? 0) >= maxDrivers) {
    return {
      allowed: false,
      quotaReached: true,
      message:
        plan === 'free_mvp'
          ? `Limite atteinte (${maxDrivers} livreur max sur MVP Gratuit). Passez en Pro (jusqu'à ${quotas.pro_max_drivers} livreurs) ou Business (illimité) via Mobile Money.`
          : `Limite atteinte (${maxDrivers} livreurs max sur le forfait Pro). Passez au forfait Business (25 000 F/mois) pour une flotte illimitée.`,
    }
  }

  return { allowed: true }
}
