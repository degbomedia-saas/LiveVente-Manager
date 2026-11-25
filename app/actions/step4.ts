'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { assertStoreNotSuspended } from '@/lib/supabase/store-status'
import {
  checkDriverQuota,
  DEFAULT_PLAN_QUOTAS,
  encodeMaintenanceWithMerchants,
} from '@/lib/quotas'

function generateHexToken(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createDriverInvitation(input: {
  fullName: string
  phone: string
  email?: string
  zoneName?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Non authentifié.' }

  const profile = await getOrCreateProfile(supabase, user)

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) {
    return { error: subCheck.error }
  }

  // Vérification du quota de livreurs selon le forfait (free_mvp = 1, pro = 3, business = illimité)
  const quotaCheck = await checkDriverQuota(
    supabase,
    user.id,
    profile.company_id
  )
  if (!quotaCheck.allowed) {
    return {
      error: quotaCheck.message,
      quotaReached: true as const,
    }
  }

  const token = generateHexToken()

  const { data: storeRow } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const { data: driver, error } = await supabase
    .from('drivers')
    .insert({
      seller_id: storeRow?.id ?? null,
      company_id: profile.company_id,
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      zone_name: input.zoneName?.trim() || 'Tokoin',
      invite_token: token,
      is_active: true,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    return {
      error:
        'Exécutez la migration 020 dans Supabase pour activer la table public.drivers.',
      token,
    }
  }

  revalidatePath('/dashboard/drivers')
  revalidatePath('/dashboard/couriers')
  return { success: true as const, driver, token }
}

export async function autoAssignOrdersByZone() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const profile = await getOrCreateProfile(supabase, user)

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) {
    return { error: subCheck.error }
  }

  // Récupérer les livreurs actifs (table drivers + profiles role=courier)
  const [{ data: drivers }, { data: courierProfiles }, { data: orders }] =
    await Promise.all([
      supabase
        .from('drivers')
        .select('id, user_id, full_name, zone_name, deliveries_count')
        .eq('company_id', profile.company_id)
        .eq('is_active', true),
      supabase
        .from('profiles')
        .select('id, full_name, zone')
        .eq('company_id', profile.company_id)
        .eq('role', 'courier')
        .eq('is_active', true),
      supabase
        .from('orders')
        .select('id, status, customers(city, address), deliveries(id)')
        .eq('company_id', profile.company_id)
        .in('status', ['confirmed', 'packed', 'ready']),
    ])

  const candidates = [
    ...(courierProfiles ?? []).map((c) => ({
      profileId: c.id,
      driverId: null as string | null,
      name: c.full_name,
      zone: (c.zone || 'Tokoin').toLowerCase(),
      load: 0,
    })),
    ...(drivers ?? [])
      .filter((d) => d.user_id)
      .map((d) => ({
        profileId: d.user_id as string,
        driverId: d.id,
        name: d.full_name,
        zone: (d.zone_name || 'Tokoin').toLowerCase(),
        load: d.deliveries_count ?? 0,
      })),
  ]

  if (candidates.length === 0) {
    return { error: 'Aucun livreur actif disponible pour l’assignation auto.' }
  }

  let assignedCount = 0
  for (const order of orders ?? []) {
    const existingDeliveries = Array.isArray(order.deliveries)
      ? order.deliveries
      : []
    if (existingDeliveries.length > 0) continue

    const cust = Array.isArray(order.customers)
      ? order.customers[0]
      : order.customers
    const targetCity = (
      cust?.city ||
      cust?.address ||
      'Tokoin'
    ).toLowerCase()

    // Trouver un livreur de la même zone ou le moins chargé
    const matched =
      candidates.find((c) => targetCity.includes(c.zone)) ??
      candidates.sort((a, b) => a.load - b.load)[0]

    if (matched) {
      await supabase.from('deliveries').insert({
        company_id: profile.company_id,
        order_id: order.id,
        courier_id: matched.profileId,
        driver_id: matched.driverId,
        status: 'assigned',
        delivery_address: cust?.city || cust?.address || 'Lomé',
      })
      matched.load += 1
      assignedCount += 1
    }
  }

  revalidatePath('/dashboard/drivers')
  revalidatePath('/dashboard/orders')
  return { success: true as const, assignedCount }
}

export async function markOrderPackedByScan(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  await supabase
    .from('orders')
    .update({ status: 'packed' })
    .eq('id', orderId)

  revalidatePath(`/dashboard/orders/${orderId}/label`)
  revalidatePath('/dashboard/orders')
  return { success: true as const }
}

export type DeliveryFailureReason =
  | 'injoignable'
  | 'absente'
  | 'refuse'
  | 'adresse_introuvable'
  | 'autre_moment'

const ALLOWED_FAILURE_REASONS: DeliveryFailureReason[] = [
  'injoignable',
  'absente',
  'refuse',
  'adresse_introuvable',
  'autre_moment',
]

export async function submitDriverDeliveryPod(input: {
  deliveryId?: string
  orderId: string
  outcome?: 'delivered' | 'failed'
  recipientName?: string
  failureReason?: DeliveryFailureReason
  proofPhotoUrl?: string | null
  codAmountCollected: number
  codStatus: 'collected' | 'disputed' | 'not_applicable'
  notes?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const profile = await getOrCreateProfile(supabase, user)

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) {
    return { error: subCheck.error }
  }
  const outcome = input.outcome ?? 'delivered'

  if (outcome === 'delivered') {
    if (!input.recipientName || !input.recipientName.trim()) {
      return {
        error:
          'Le nom du réceptionnaire est obligatoire pour valider une livraison.',
      }
    }
  } else {
    if (
      !input.failureReason ||
      !ALLOWED_FAILURE_REASONS.includes(input.failureReason)
    ) {
      return {
        error:
          'Un motif valide (injoignable, absente, refuse, adresse_introuvable, autre_moment) est obligatoire en cas d’échec.',
      }
    }
  }

  // 1. Conserver chaque tentative dans l'historique (jamais d'écrasement)
  await supabase.from('delivery_attempts').insert({
    delivery_id: input.deliveryId || null,
    order_id: input.orderId,
    courier_id: user.id,
    company_id: profile.company_id || null,
    outcome,
    recipient_name:
      outcome === 'delivered' ? input.recipientName?.trim() : null,
    failure_reason: outcome === 'failed' ? input.failureReason : null,
    proof_photo_url: input.proofPhotoUrl || null,
    cod_amount_collected: outcome === 'delivered' ? input.codAmountCollected : 0,
    notes: input.notes?.trim() || null,
  })

  if (input.deliveryId) {
    await supabase.from('delivery_proofs').insert({
      company_id: profile.company_id,
      delivery_id: input.deliveryId,
      recipient_name:
        outcome === 'delivered' ? input.recipientName?.trim() : null,
      photo_url: input.proofPhotoUrl || null,
      notes:
        outcome === 'failed'
          ? `[TENTATIVE ÉCHOUÉE: ${input.failureReason}] ${input.notes || ''}`.trim()
          : `Réceptionné par : ${input.recipientName?.trim()}`,
    })
  }

  // 2. Mettre à jour le statut courant
  if (outcome === 'delivered') {
    await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', input.orderId)

    if (input.deliveryId) {
      await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          proof_photo_url: input.proofPhotoUrl || null,
          cod_amount_collected: input.codAmountCollected,
          cod_status: input.codStatus,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', input.deliveryId)
    }
  } else if (input.deliveryId) {
    await supabase
      .from('deliveries')
      .update({
        status: 'failed',
        failed_reason: input.failureReason,
      })
      .eq('id', input.deliveryId)
  }

  revalidatePath('/driver')
  revalidatePath('/mes-livraisons')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/finances')
  return { success: true as const }
}

export async function recordPartialOrFullSettlement(input: {
  driverId?: string | null
  expectedAmountFcfa: number
  remittedAmountFcfa: number
  deliveryFeesFcfa: number
  isPartial: boolean
  notes?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const profile = await getOrCreateProfile(supabase, user)

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) {
    return { error: subCheck.error }
  }
  if (profile.role === 'employee' || profile.role === 'courier' || profile.role === 'driver') {
    return {
      error:
        'Accès refusé : les employés et livreurs ne peuvent pas enregistrer de rapprochement financier.',
    }
  }

  const { data: storeRow } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const expected = Math.max(0, Math.round(input.expectedAmountFcfa))
  const remitted = Math.max(0, Math.round(input.remittedAmountFcfa))
  const discrepancy = remitted - expected
  const fees = Math.max(0, Math.round(input.deliveryFeesFcfa))

  // Toujours INSERT pour ne jamais écraser l'historique des remises partielles
  const { error } = await supabase.from('settlements').insert({
    seller_id: storeRow?.id ?? null,
    company_id: profile.company_id,
    driver_id: input.driverId || null,
    total_cod_fcfa: remitted,
    delivery_fees_fcfa: fees,
    platform_fee_fcfa: 0,
    net_payout_fcfa: remitted,
    expected_amount_fcfa: expected,
    remitted_amount_fcfa: remitted,
    discrepancy_fcfa: discrepancy,
    is_partial: input.isPartial,
    notes: input.notes?.trim() || null,
    status: discrepancy >= 0 && !input.isPartial ? 'paid_out' : 'pending',
    paid_at: new Date().toISOString(),
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard/finances')
  revalidatePath('/dashboard/payments')
  return { success: true as const, discrepancy }
}

export async function confirmPublicDeliveryAndRate(input: {
  token: string
  rating: number
}) {
  const supabase = await createClient()

  // 1. Essayer via la fonction RPC SECURITY DEFINER (migration 020)
  const { data: rpcRes, error: rpcErr } = await supabase.rpc(
    'confirm_public_delivery_and_rate',
    {
      p_token: input.token,
      p_rating: input.rating,
    }
  )

  if (!rpcErr && rpcRes) {
    revalidatePath(`/track/${input.token}`)
    return {
      success: true as const,
      loyaltyPoints: (rpcRes as { loyalty_points?: number }).loyalty_points ?? 1,
    }
  }

  // 2. Repli direct si la fonction RPC n'est pas encore créée
  const { data: order } = await supabase
    .from('orders')
    .select('id, customer_id')
    .eq('id', input.token)
    .maybeSingle()

  if (order) {
    await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', order.id)
  }

  revalidatePath(`/track/${input.token}`)
  return { success: true as const, loyaltyPoints: 2 }
}

export async function createOrderReturn(input: {
  orderId: string
  reason: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const profile = await getOrCreateProfile(supabase, user)

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) {
    return { error: subCheck.error }
  }
  const { data: storeRow } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('returns').insert({
    order_id: input.orderId,
    seller_id: storeRow?.id ?? null,
    company_id: profile.company_id,
    reason: input.reason.trim(),
    status: 'requested',
  })

  if (error) {
    return {
      error:
        'Exécutez la migration 020 dans Supabase pour activer la table public.returns.',
    }
  }

  revalidatePath('/dashboard/returns')
  return { success: true as const }
}

export async function updateReturnStatus(input: {
  returnId: string
  orderId: string
  nextStatus:
    | 'requested'
    | 'approved'
    | 'in_transit'
    | 'received'
    | 'restocked'
    | 'settled'
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { error } = await supabase
    .from('returns')
    .update({
      status: input.nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.returnId)

  if (error) {
    return { error: error.message }
  }

  if (input.nextStatus === 'restocked') {
    await supabase
      .from('orders')
      .update({ status: 'returned' })
      .eq('id', input.orderId)
  }

  revalidatePath('/dashboard/returns')
  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard/orders')
  return { success: true as const }
}

const platformSettingsSchema = z.object({
  saasName: z.string().trim().min(1).max(100),
  saasLogoUrl: z.string().trim().max(2000).nullable().optional(),
  freeMvpMaxOrdersMonth: z.number().int().min(1).max(100000).optional(),
  freeMvpMaxDrivers: z.number().int().min(1).max(10000).optional(),
  freeMvpMaxAiTrials: z.number().int().min(1).max(10000).optional(),
  proMaxDrivers: z.number().int().min(1).max(10000).optional(),
  isMaintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(1000).nullable().optional(),
  merchantTmoneyPhone: z.string().trim().max(60).optional(),
  merchantFloozPhone: z.string().trim().max(60).optional(),
})

export async function updatePlatformSettings(input: {
  saasName: string
  saasLogoUrl?: string | null
  freeMvpMaxOrdersMonth?: number
  freeMvpMaxDrivers?: number
  freeMvpMaxAiTrials?: number
  proMaxDrivers?: number
  isMaintenanceMode?: boolean
  maintenanceMessage?: string | null
  merchantTmoneyPhone?: string
  merchantFloozPhone?: string
}) {
  const parsed = platformSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') {
    return { error: 'Accès réservé aux administrateurs.' }
  }

  const { data: existing } = await supabase
    .from('platform_settings')
    .select('id')
    .limit(1)
    .maybeSingle()

  const data = parsed.data
  const tmoneyPhone =
    data.merchantTmoneyPhone?.trim() ||
    DEFAULT_PLAN_QUOTAS.merchant_tmoney_phone
  const floozPhone =
    data.merchantFloozPhone?.trim() || DEFAULT_PLAN_QUOTAS.merchant_flooz_phone

  const encodedMaintenance = encodeMaintenanceWithMerchants(
    data.maintenanceMessage,
    tmoneyPhone,
    floozPhone
  )

  const basePayload: Record<string, unknown> = {
    saas_name: data.saasName,
    saas_logo_url: data.saasLogoUrl || null,
    free_mvp_max_orders_month: data.freeMvpMaxOrdersMonth ?? 20,
    free_mvp_max_drivers: data.freeMvpMaxDrivers ?? 1,
    free_mvp_max_ai_trials: data.freeMvpMaxAiTrials ?? 3,
    pro_max_drivers: data.proMaxDrivers ?? 3,
    maintenance_message: encodedMaintenance,
    updated_at: new Date().toISOString(),
  }

  if (typeof data.isMaintenanceMode === 'boolean') {
    basePayload.is_maintenance_mode = data.isMaintenanceMode
  }

  const fullPayload: Record<string, unknown> = {
    ...basePayload,
    merchant_tmoney_phone: tmoneyPhone,
    merchant_flooz_phone: floozPhone,
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('platform_settings')
      .update(fullPayload)
      .eq('id', existing.id)
    if (error) {
      const { error: baseErr } = await supabase
        .from('platform_settings')
        .update(basePayload)
        .eq('id', existing.id)
      if (baseErr) {
        await supabase
          .from('platform_settings')
          .update({
            saas_name: data.saasName,
            saas_logo_url: data.saasLogoUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      }
    }
  } else {
    await supabase.from('platform_settings').insert({
      saas_name: data.saasName,
      saas_logo_url: data.saasLogoUrl || null,
    })
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/maintenance')
  revalidatePath('/')
  return { success: true as const }
}

const logEntrySchema = z.object({
  level: z.enum(['info', 'warning', 'error', 'critical']).default('error'),
  source: z.string().trim().min(1).max(120).default('admin'),
  message: z.string().trim().min(1).max(1000),
})

export async function recordAdminSystemLog(input: {
  level?: 'info' | 'warning' | 'error' | 'critical'
  source?: string
  message: string
}) {
  const parsed = logEntrySchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Format de journal invalide.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') {
    return { error: 'Non autorisé.' }
  }

  const { error } = await supabase.from('system_logs').insert({
    level: parsed.data.level,
    source: parsed.data.source,
    message: parsed.data.message,
    user_id: user.id,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true as const }
}

export async function archiveDriver(driverId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const profile = await getOrCreateProfile(supabase, user)
  if (!profile.company_id) return { error: 'Profil introuvable.' }

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) return { error: subCheck.error }

  const { error } = await supabase
    .from('drivers')
    .update({ is_archived: true, is_active: false })
    .eq('id', driverId)
    .eq('company_id', profile.company_id)

  if (error) {
    await supabase
      .from('drivers')
      .update({ is_active: false })
      .eq('id', driverId)
      .eq('company_id', profile.company_id)
  }

  revalidatePath('/dashboard/drivers')
  revalidatePath('/dashboard/couriers')
  return { success: true as const }
}

export async function clearAdminSystemLogs() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'super_admin' && profile?.role !== 'admin') {
    return { error: 'Non autorisé.' }
  }

  const { error } = await supabase
    .from('system_logs')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true as const }
}

export async function handleSubscriptionRequest(input: {
  requestId: string
  sellerId: string
  requestedPlan: 'free_mvp' | 'pro' | 'business'
  decision: 'approved' | 'rejected'
}) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('subscription_requests')
    .update({
      status: input.decision,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.requestId)

  if (error) return { error: error.message }

  if (input.decision === 'approved' && input.sellerId) {
    const { data: updatedStore } = await supabase
      .from('stores')
      .update({
        plan: input.requestedPlan,
        plan_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sellerId)
      .select('company_id')
      .maybeSingle()

    if (updatedStore?.company_id) {
      const now = new Date()
      const newEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          plan_type: input.requestedPlan === 'business' ? 'enterprise' : 'pro',
          current_period_starts_at: now.toISOString(),
          current_period_ends_at: newEnd.toISOString(),
        })
        .eq('company_id', updatedStore.company_id)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/super-admin')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  return { success: true as const }
}

const paywallSubscriptionRequestSchema = z.object({
  billingCycle: z.enum(['monthly', 'quarterly']).default('monthly'),
  mobileMoneyRef: z
    .string()
    .trim()
    .min(3, 'Veuillez saisir la référence de votre transfert T-Money ou Flooz.')
    .max(120, 'La référence est trop longue.'),
  phone: z.string().trim().max(40).optional(),
})

export async function submitPaywallSubscriptionRequest(input: {
  billingCycle?: 'monthly' | 'quarterly'
  mobileMoneyRef: string
  phone?: string
}) {
  const parsed = paywallSubscriptionRequestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        'Veuillez vérifier la référence Mobile Money saisie.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const profile = await getOrCreateProfile(supabase, user)

  let storeQuery = supabase
    .from('stores')
    .select('id, store_name, whatsapp_phone')
    .limit(1)

  if (profile.company_id) {
    storeQuery = storeQuery.or(
      `owner_id.eq.${user.id},company_id.eq.${profile.company_id}`
    )
  } else {
    storeQuery = storeQuery.eq('owner_id', user.id)
  }

  const { data: existingStore } = await storeQuery.maybeSingle()

  const metaPhone =
    typeof user.user_metadata?.phone === 'string'
      ? user.user_metadata.phone
      : null
  let storeId = existingStore?.id ?? null
  let storePhone = existingStore?.whatsapp_phone || metaPhone || '+228'

  if (!storeId) {
    const { data: createdStore, error: createStoreErr } = await supabase
      .from('stores')
      .upsert(
        {
          owner_id: user.id,
          company_id: profile.company_id ?? null,
          store_name: profile.companies?.name || 'Ma Boutique Lomé',
          whatsapp_phone: parsed.data.phone || metaPhone || null,
          city: 'Lomé',
          palette_key: 'emerald',
          plan: 'free_mvp',
          plan_status: 'trial',
        },
        { onConflict: 'owner_id' }
      )
      .select('id, whatsapp_phone')
      .maybeSingle()

    if (createStoreErr || !createdStore?.id) {
      return {
        error:
          'Impossible de récupérer votre boutique pour enregistrer la demande.',
      }
    }
    storeId = createdStore.id
    storePhone = createdStore.whatsapp_phone || storePhone
  }

  const cyclePrefix =
    parsed.data.billingCycle === 'quarterly'
      ? '[15 000 FCFA / 3 mois] '
      : '[5 000 FCFA / mois] '

  const formattedRef = `${cyclePrefix}${parsed.data.mobileMoneyRef.trim()}`
  const finalPhone = parsed.data.phone?.trim() || storePhone || '+228'

  const { error: insertErr } = await supabase
    .from('subscription_requests')
    .insert({
      seller_id: storeId,
      requested_plan: 'pro',
      mobile_money_ref: formattedRef,
      phone: finalPhone,
      status: 'pending',
    })

  if (insertErr) {
    return {
      error:
        'Impossible d’enregistrer la référence Mobile Money. Réessayez ou envoyez votre preuve sur WhatsApp.',
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  return {
    success: true as const,
    reference: formattedRef,
    storeId,
  }
}
