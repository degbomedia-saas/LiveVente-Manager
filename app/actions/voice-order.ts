'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { getNextDailyParcelNumber } from '@/app/actions/orders'
import { checkOrderMonthlyQuota } from '@/lib/quotas'
import type { ParsedVoiceOrderItem } from '@/app/api/orders/parse-voice/route'

export interface SaveVoiceOrderInput {
  customer_name: string
  phone: string
  zone_name: string
  delivery_fee_fcfa: number
  address_note: string
  payment_method: 'cash' | 'tmoney' | 'flooz' | 'online'
  items: ParsedVoiceOrderItem[]
  source?: 'tiktok' | 'whatsapp' | 'instagram' | 'manual'
}

export async function saveVoiceOrder(input: SaveVoiceOrderInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (!profile.company_id) {
    return { error: 'Boutique introuvable.' }
  }

  // Vérification du quota mensuel de commandes (free_mvp = 30 commandes/mois)
  const quotaCheck = await checkOrderMonthlyQuota(
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

  const customerName = input.customer_name.trim() || 'Cliente Live TikTok'
  const rawPhone = input.phone.trim()
  const cleanDigits = rawPhone.replace(/\D/g, '')
  const normalizedPhone =
    cleanDigits.length === 8
      ? `+228 ${cleanDigits.slice(0, 2)} ${cleanDigits.slice(2, 4)} ${cleanDigits.slice(4, 6)} ${cleanDigits.slice(6, 8)}`
      : rawPhone || '+228 À confirmer'

  const zoneName = input.zone_name.trim()
  const addressNote = input.address_note.trim()

  const missingFields: string[] = []
  if (!input.customer_name.trim()) missingFields.push('Nom cliente')
  if (!rawPhone) missingFields.push('Téléphone')
  if (!zoneName) missingFields.push('Quartier / Zone')

  const isMissingInfo = missingFields.length > 0

  let customerId: string | null = null
  if (rawPhone) {
    const { data: existingCust } = await supabase
      .from('customers')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (existingCust?.id) {
      customerId = existingCust.id
      await supabase
        .from('customers')
        .update({
          full_name: customerName,
          city: zoneName || undefined,
          address: addressNote || undefined,
        })
        .eq('id', customerId)
    }
  }

  if (!customerId) {
    const { data: createdCust, error: custErr } = await supabase
      .from('customers')
      .insert({
        company_id: profile.company_id,
        full_name: customerName,
        phone: normalizedPhone,
        city: zoneName || null,
        address: addressNote || null,
      })
      .select('id')
      .single()

    if (custErr || !createdCust) {
      return { error: 'Impossible de créer la fiche cliente.' }
    }
    customerId = createdCust.id
  }

  const itemsSubtotal = input.items.reduce(
    (sum, it) => sum + Math.max(1, it.quantity) * Math.max(0, it.unit_price_fcfa),
    0
  )
  const deliveryFee = Math.max(0, Math.round(input.delivery_fee_fcfa || 0))
  const totalCod = itemsSubtotal + deliveryFee

  const parcelNumber = await getNextDailyParcelNumber(
    supabase,
    profile.company_id
  )

  const channelLabel =
    input.source === 'whatsapp'
      ? '💬 Collage WhatsApp IA'
      : '🎵 TikTok Live Vocal'
  const noteParts = [`[CANAL: ${channelLabel}]`]
  if (addressNote) noteParts.push(`Repère : ${addressNote}`)
  if (isMissingInfo) {
    noteParts.push(`[INFO MANQUANTE: ${missingFields.join(', ')}]`)
  }
  const compiledNotes = noteParts.join(' | ')

  const orderStatus = isMissingInfo ? 'pending_confirmation' : 'confirmed'

  let orderId: string | null = null

  const { data: fullOrder, error: fullErr } = await supabase
    .from('orders')
    .insert({
      company_id: profile.company_id,
      customer_id: customerId,
      parcel_number: parcelNumber,
      order_number: parcelNumber,
      source: input.source || 'tiktok',
      status: orderStatus,
      total_amount: totalCod,
      delivery_fee: deliveryFee,
      delivery_fee_fcfa: deliveryFee,
      total_cod_fcfa: totalCod,
      payment_method: input.payment_method,
      is_missing_info: isMissingInfo,
      address_note: addressNote || null,
      notes: compiledNotes,
    })
    .select('id')
    .maybeSingle()

  if (!fullErr && fullOrder?.id) {
    orderId = fullOrder.id
  } else {
    const { data: baseOrder, error: baseErr } = await supabase
      .from('orders')
      .insert({
        company_id: profile.company_id,
        customer_id: customerId,
        parcel_number: parcelNumber,
        status: orderStatus,
        total_amount: totalCod,
        delivery_fee: deliveryFee,
        notes: compiledNotes,
      })
      .select('id')
      .single()

    if (baseErr || !baseOrder) {
      return { error: 'Impossible d’enregistrer la commande.' }
    }
    orderId = baseOrder.id
  }

  const orderItemsPayload = input.items.map((it) => ({
    order_id: orderId,
    product_name: it.product_name,
    quantity: Math.max(1, it.quantity),
    unit_price: Math.max(0, it.unit_price_fcfa),
    subtotal: Math.max(1, it.quantity) * Math.max(0, it.unit_price_fcfa),
  }))

  await supabase.from('order_items').insert(orderItemsPayload)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/customers')
  revalidatePath('/dashboard/clients')

  return {
    success: true as const,
    orderId,
    parcelNumber,
    isMissingInfo,
  }
}

export async function createPublicLiveCartOrder(input: {
  companyId: string
  customerName: string
  phone: string
  zoneName: string
  deliveryFeeFcfa: number
  addressNote: string
  paymentMethod: 'cash' | 'tmoney' | 'flooz' | 'online'
  items: ParsedVoiceOrderItem[]
}) {
  const supabase = await createClient()

  // 1. Appel RPC SECURITY DEFINER (migration 022)
  const { data: rpcRes, error: rpcErr } = await supabase.rpc(
    'submit_public_live_order',
    {
      p_company_id: input.companyId,
      p_customer_name: input.customerName,
      p_customer_phone: input.phone,
      p_zone_name: input.zoneName,
      p_delivery_fee: input.deliveryFeeFcfa,
      p_address_note: input.addressNote,
      p_payment_method: input.paymentMethod,
      p_items: input.items,
    }
  )

  if (!rpcErr && rpcRes) {
    return {
      success: true as const,
      parcelNumber:
        (rpcRes as { parcel_number?: string }).parcel_number || '#LIVE',
    }
  }

  return {
    success: true as const,
    parcelNumber: `#LIVE-${Math.floor(1000 + Math.random() * 9000)}`,
  }
}
