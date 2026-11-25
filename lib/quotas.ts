import type { SupabaseClient } from '@supabase/supabase-js'

export interface PlanQuotasConfig {
  free_mvp_max_orders_month: number
  free_mvp_max_drivers: number
  free_mvp_max_ai_trials: number
  pro_max_drivers: number
  merchant_tmoney_phone: string
  merchant_flooz_phone: string
}

export const DEFAULT_PLAN_QUOTAS: PlanQuotasConfig = {
  free_mvp_max_orders_month: 20,
  free_mvp_max_drivers: 1,
  free_mvp_max_ai_trials: 3,
  pro_max_drivers: 3,
  merchant_tmoney_phone: '+228 90 12 34 56',
  merchant_flooz_phone: '+228 96 12 34 56',
}

const PAYWALL_META_REGEX = /<!--PAYWALL_MERCHANT:(\{[\s\S]*?\})-->/

export function parsePlatformMaintenanceAndMerchants(
  rawRow?: Record<string, unknown> | null
): {
  cleanMaintenanceMessage: string | null
  tmoneyPhone: string
  floozPhone: string
} {
  const rawMessage =
    typeof rawRow?.maintenance_message === 'string'
      ? rawRow.maintenance_message
      : null

  let embeddedTmoney: string | null = null
  let embeddedFlooz: string | null = null
  let cleanMessage = rawMessage

  if (rawMessage) {
    const match = rawMessage.match(PAYWALL_META_REGEX)
    if (match?.[1]) {
      try {
        const parsed = JSON.parse(match[1]) as {
          tmoney?: string
          flooz?: string
        }
        if (parsed.tmoney?.trim()) embeddedTmoney = parsed.tmoney.trim()
        if (parsed.flooz?.trim()) embeddedFlooz = parsed.flooz.trim()
      } catch {
        // Ignore malformed tag
      }
      cleanMessage = rawMessage.replace(PAYWALL_META_REGEX, '').trim() || null
    }
  }

  const colTmoney =
    typeof rawRow?.merchant_tmoney_phone === 'string' &&
    rawRow.merchant_tmoney_phone.trim()
      ? rawRow.merchant_tmoney_phone.trim()
      : null
  const colFlooz =
    typeof rawRow?.merchant_flooz_phone === 'string' &&
    rawRow.merchant_flooz_phone.trim()
      ? rawRow.merchant_flooz_phone.trim()
      : null

  return {
    cleanMaintenanceMessage: cleanMessage,
    tmoneyPhone:
      colTmoney || embeddedTmoney || DEFAULT_PLAN_QUOTAS.merchant_tmoney_phone,
    floozPhone:
      colFlooz || embeddedFlooz || DEFAULT_PLAN_QUOTAS.merchant_flooz_phone,
  }
}

export function encodeMaintenanceWithMerchants(
  cleanMessage: string | null | undefined,
  tmoneyPhone: string,
  floozPhone: string
): string {
  const base = (cleanMessage ?? '').replace(PAYWALL_META_REGEX, '').trim()
  const payload = JSON.stringify({
    tmoney: tmoneyPhone.trim() || DEFAULT_PLAN_QUOTAS.merchant_tmoney_phone,
    flooz: floozPhone.trim() || DEFAULT_PLAN_QUOTAS.merchant_flooz_phone,
  })
  return `${base}<!--PAYWALL_MERCHANT:${payload}-->`
}

export async function getPlatformQuotas(
  supabase: SupabaseClient
): Promise<PlanQuotasConfig> {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (!data) return DEFAULT_PLAN_QUOTAS
    const { tmoneyPhone, floozPhone } = parsePlatformMaintenanceAndMerchants(
      data as Record<string, unknown>
    )
    const rawMaxOrders = Number(data.free_mvp_max_orders_month)
    const normalizedMaxOrders =
      !rawMaxOrders || rawMaxOrders === 30 ? 20 : rawMaxOrders

    return {
      free_mvp_max_orders_month: normalizedMaxOrders,
      free_mvp_max_drivers:
        Number(data.free_mvp_max_drivers) ||
        DEFAULT_PLAN_QUOTAS.free_mvp_max_drivers,
      free_mvp_max_ai_trials:
        Number(data.free_mvp_max_ai_trials) ||
        DEFAULT_PLAN_QUOTAS.free_mvp_max_ai_trials,
      pro_max_drivers:
        Number(data.pro_max_drivers) || DEFAULT_PLAN_QUOTAS.pro_max_drivers,
      merchant_tmoney_phone: tmoneyPhone,
      merchant_flooz_phone: floozPhone,
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
  storeName: string | null
  whatsappPhone: string | null
}> {
  let storeQuery = supabase
    .from('stores')
    .select('id, store_name, whatsapp_phone, plan, ai_trials_used')
    .limit(1)

  if (companyId) {
    storeQuery = storeQuery.or(`owner_id.eq.${userId},company_id.eq.${companyId}`)
  } else {
    storeQuery = storeQuery.eq('owner_id', userId)
  }

  const [{ data: store }, { data: sub }] = await Promise.all([
    storeQuery.maybeSingle(),
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
    storeName: store?.store_name ?? null,
    whatsappPhone: store?.whatsapp_phone ?? null,
  }
}

export interface SellerPaywallInfo {
  plan: 'free_mvp' | 'pro' | 'business'
  storeId: string | null
  storeName: string
  storePhone: string
  ordersUsed: number
  freeOrdersLimit: number
  tmoneyPhone: string
  floozPhone: string
  hasPendingRequest: boolean
  pendingReference: string | null
}

export async function getSellerPaywallInfo(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  fallbackStoreName = 'Ma Boutique'
): Promise<SellerPaywallInfo> {
  const [sellerPlan, quotas, { count: ordersCount }] = await Promise.all([
    getEffectiveSellerPlan(supabase, userId, companyId),
    getPlatformQuotas(supabase),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .neq('status', 'cancelled'),
  ])

  let hasPendingRequest = false
  let pendingReference: string | null = null

  if (sellerPlan.storeId) {
    const { data: pendingReq } = await supabase
      .from('subscription_requests')
      .select('id, mobile_money_ref, status')
      .eq('seller_id', sellerPlan.storeId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (pendingReq) {
      hasPendingRequest = true
      pendingReference = pendingReq.mobile_money_ref
    }
  }

  return {
    plan: sellerPlan.plan,
    storeId: sellerPlan.storeId,
    storeName: sellerPlan.storeName || fallbackStoreName,
    storePhone: sellerPlan.whatsappPhone || '',
    ordersUsed: ordersCount ?? 0,
    freeOrdersLimit: 20,
    tmoneyPhone: quotas.merchant_tmoney_phone,
    floozPhone: quotas.merchant_flooz_phone,
    hasPendingRequest,
    pendingReference,
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
      message: `Quota gratuit atteint (${quotas.free_mvp_max_ai_trials}/${quotas.free_mvp_max_ai_trials} essais IA audio/texte). Passez au forfait Pro (5 000 F/mois via T-Money / Flooz) pour débloquer l'IA illimitée.`,
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

  const maxFreeOrders = quotas.free_mvp_max_orders_month || 20

  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .neq('status', 'cancelled')

  if ((count ?? 0) >= maxFreeOrders) {
    return {
      allowed: false,
      quotaReached: true,
      message: `Vos ${maxFreeOrders} premières commandes gratuites sont bouclées ! Activez la formule Pro (5 000 FCFA/mois via T-Money ou Flooz) pour continuer en illimité.`,
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
          : `Limite atteinte (${maxDrivers} livreurs max sur le forfait Pro). Passez au forfait Business pour une flotte illimitée.`,
    }
  }

  return { allowed: true }
}
