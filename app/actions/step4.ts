'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { checkDriverQuota } from '@/lib/quotas'

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

export async function updatePlatformSettings(input: {
  saasName: string
  saasLogoUrl?: string | null
  freeMvpMaxOrdersMonth?: number
  freeMvpMaxDrivers?: number
  freeMvpMaxAiTrials?: number
  proMaxDrivers?: number
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: existing } = await supabase
    .from('platform_settings')
    .select('id')
    .limit(1)
    .maybeSingle()

  const payload = {
    saas_name: input.saasName.trim(),
    saas_logo_url: input.saasLogoUrl || null,
    free_mvp_max_orders_month: input.freeMvpMaxOrdersMonth ?? 30,
    free_mvp_max_drivers: input.freeMvpMaxDrivers ?? 1,
    free_mvp_max_ai_trials: input.freeMvpMaxAiTrials ?? 3,
    pro_max_drivers: input.proMaxDrivers ?? 3,
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('platform_settings')
      .update(payload)
      .eq('id', existing.id)
    if (error) {
      await supabase
        .from('platform_settings')
        .update({
          saas_name: input.saasName.trim(),
          saas_logo_url: input.saasLogoUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
  } else {
    await supabase.from('platform_settings').insert({
      saas_name: input.saasName.trim(),
      saas_logo_url: input.saasLogoUrl || null,
    })
  }

  revalidatePath('/admin')
  revalidatePath('/')
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
    await supabase
      .from('stores')
      .update({
        plan: input.requestedPlan,
        plan_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.sellerId)
  }

  revalidatePath('/admin')
  revalidatePath('/super-admin')
  return { success: true as const }
}
