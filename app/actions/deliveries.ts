'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import {
  assignDeliverySchema,
  completeDeliverySchema,
  createCourierSchema,
  toggleCourierStatusSchema,
  updateDeliveryStatusSchema,
  type AssignDeliveryInput,
  type CompleteDeliveryInput,
  type CreateCourierInput,
  type ToggleCourierStatusInput,
  type UpdateDeliveryStatusInput,
} from '@/lib/validations/deliveries'

export async function createCourier(rawData: CreateCourierInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const parsed = createCourierSchema.safeParse(rawData)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, field: first.path[0] as string | undefined }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Base de données non initialisée.' }
  }

  if (profile.role !== 'owner' && profile.role !== 'employee') {
    return { error: 'Action non autorisée.' }
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'create_courier_profile',
    {
      p_full_name: parsed.data.fullName,
      p_phone: parsed.data.phone,
      p_is_active: parsed.data.isActive,
      p_email: parsed.data.email,
      p_password: parsed.data.password,
    }
  )

  let createdCourierId: string | null = null

  if (rpcError) {
    console.error('RPC create_courier_profile error:', rpcError.code, rpcError.message)

    // Repli via API Auth officielle si le RPC échoue (ex: pgcrypto, schéma auth.users ou migration 004 absente)
    if (parsed.data.email && parsed.data.password) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !anonKey) {
        return { error: `Erreur RPC (${rpcError.message}). Variables Supabase manquantes.` }
      }

      const authClient = createSupabaseJsClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
        email: parsed.data.email.trim().toLowerCase(),
        password: parsed.data.password,
        options: {
          data: {
            full_name: parsed.data.fullName.trim(),
            skip_auto_profile: true,
          },
        },
      })

      if (signUpError) {
        const msg = signUpError.message.toLowerCase()
        if (msg.includes('already registered') || msg.includes('already exists')) {
          return { error: 'Un compte existe déjà avec cet email.' }
        }
        return { error: `Impossible de créer le compte livreur : ${signUpError.message}` }
      }

      if (!signUpData.user?.id) {
        return { error: `Impossible de créer le compte livreur (${rpcError.message}).` }
      }

      const { error: insertProfileErr } = await supabase.from('profiles').insert({
        id: signUpData.user.id,
        company_id: profile.company_id,
        full_name: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        role: 'courier',
        is_active: parsed.data.isActive,
      })

      if (insertProfileErr) {
        return {
          error: `Compte auth créé mais profil refusé (${insertProfileErr.message}). Exécutez supabase/migrations/004_couriers_deliveries.sql dans Supabase.`,
        }
      }

      createdCourierId = signUpData.user.id
    } else {
      // Livreur sans email/mot de passe
      const { data: insertedProfile, error: insertNoAuthErr } = await supabase
        .from('profiles')
        .insert({
          company_id: profile.company_id,
          full_name: parsed.data.fullName.trim(),
          phone: parsed.data.phone.trim(),
          role: 'courier',
          is_active: parsed.data.isActive,
        })
        .select('id')
        .single()

      if (insertNoAuthErr || !insertedProfile) {
        return {
          error: `Impossible de créer le livreur (${rpcError.message}). Vérifiez que supabase/migrations/004_couriers_deliveries.sql est exécuté dans Supabase.`,
        }
      }

      createdCourierId = insertedProfile.id
    }
  } else {
    const result = rpcData as { success: boolean; courier_id?: string; error?: string } | null
    if (!result?.success || !result.courier_id) {
      return { error: result?.error ?? 'Erreur lors de la création du livreur.' }
    }
    createdCourierId = result.courier_id
  }

  const { data: createdCourier } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active, created_at')
    .eq('id', createdCourierId)
    .single()

  revalidatePath('/dashboard/couriers')
  revalidatePath('/livreurs')
  revalidatePath('/dashboard/orders')
  revalidatePath('/commandes')
  return { success: true as const, courier: createdCourier }
}

export async function toggleCourierStatus(rawData: ToggleCourierStatusInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const parsed = toggleCourierStatusSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'owner' && profile.role !== 'employee') {
    return { error: 'Action non autorisée.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.courierId)
    .eq('company_id', profile.company_id)
    .eq('role', 'courier')

  if (error) {
    return { error: 'Impossible de modifier le statut du livreur.' }
  }

  revalidatePath('/dashboard/couriers')
  revalidatePath('/livreurs')
  revalidatePath('/dashboard/orders')
  return { success: true }
}

export async function assignDelivery(rawData: AssignDeliveryInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const parsed = assignDeliverySchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'owner' && profile.role !== 'employee') {
    return { error: 'Action non autorisée.' }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', parsed.data.orderId)
    .eq('company_id', profile.company_id)
    .single()

  if (orderError || !order) {
    return { error: 'Commande introuvable.' }
  }

  if (order.status === 'delivered' || order.status === 'cancelled') {
    return { error: 'Impossible d\'affecter une commande déjà livrée ou annulée.' }
  }

  const { data: courier, error: courierError } = await supabase
    .from('profiles')
    .select('id, full_name, phone, is_active')
    .eq('id', parsed.data.courierId)
    .eq('company_id', profile.company_id)
    .eq('role', 'courier')
    .single()

  if (courierError || !courier || !courier.is_active) {
    return { error: 'Livreur introuvable ou inactif.' }
  }

  const { data: existingDelivery } = await supabase
    .from('deliveries')
    .select('id')
    .eq('order_id', order.id)
    .eq('company_id', profile.company_id)
    .maybeSingle()

  let deliveryId = existingDelivery?.id ?? ''
  const courierFullName = courier.full_name
  const courierFirstName = courierFullName.split(' ')[0]

  if (existingDelivery) {
    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('deliveries')
      .update({
        courier_id: courier.id,
        courier_name: courierFullName,
        delivery_address: parsed.data.deliveryAddress,
        status: 'in_transit',
        scheduled_at: nowIso,
        picked_up_at: nowIso,
        failed_reason: null,
      })
      .eq('id', existingDelivery.id)
      .eq('company_id', profile.company_id)

    if (updateError) {
      await supabase
        .from('deliveries')
        .update({
          courier_id: courier.id,
          delivery_address: parsed.data.deliveryAddress,
          status: 'in_transit',
          scheduled_at: nowIso,
          picked_up_at: nowIso,
          failed_reason: null,
        })
        .eq('id', existingDelivery.id)
        .eq('company_id', profile.company_id)
    }
  } else {
    const nowIso = new Date().toISOString()
    const { data: inserted, error: insertError } = await supabase
      .from('deliveries')
      .insert({
        company_id: profile.company_id,
        order_id: order.id,
        courier_id: courier.id,
        courier_name: courierFullName,
        delivery_address: parsed.data.deliveryAddress,
        status: 'in_transit',
        scheduled_at: nowIso,
        picked_up_at: nowIso,
      })
      .select('id')
      .single()

    if (insertError) {
      const { data: fallbackIns } = await supabase
        .from('deliveries')
        .insert({
          company_id: profile.company_id,
          order_id: order.id,
          courier_id: courier.id,
          delivery_address: parsed.data.deliveryAddress,
          status: 'in_transit',
          scheduled_at: nowIso,
          picked_up_at: nowIso,
        })
        .select('id')
        .single()
      deliveryId = fallbackIns?.id ?? ''
    } else {
      deliveryId = inserted.id
    }
  }

  // Traçabilité infaillible du livreur dans la commande
  const { data: currentOrderData } = await supabase
    .from('orders')
    .select('notes, parcel_number')
    .eq('id', order.id)
    .single()

  const currentNotes = currentOrderData?.notes || ''
  const courierNote = `[LIVREUR: ${courierFullName}]`
  const updatedNotes = currentNotes.includes('[LIVREUR:')
    ? currentNotes.replace(/\[LIVREUR:[^\]]+\]/, courierNote)
    : currentNotes ? `${currentNotes} | ${courierNote}` : courierNote

  let parcelNum = currentOrderData?.parcel_number
  if (!parcelNum) {
    const { data: gen } = await supabase.rpc('generate_daily_parcel_number', {
      p_company_id: profile.company_id,
    })
    parcelNum = gen || null
  }

  await supabase
    .from('orders')
    .update({
      status: 'assigned',
      parcel_number: parcelNum,
      notes: updatedNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('company_id', profile.company_id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/payments')
  revalidatePath('/mes-livraisons')
  return {
    success: true as const,
    orderStatus: 'assigned',
    delivery: {
      id: deliveryId,
      status: 'assigned',
      courier_id: courier.id,
      delivery_address: parsed.data.deliveryAddress,
      profiles: {
        full_name: courier.full_name,
        phone: courier.phone,
      },
    },
  }
}

export async function updateCourierDeliveryStatus(rawData: UpdateDeliveryStatusInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const parsed = updateDeliveryStatusSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'courier') {
    return { error: 'Espace réservé aux livreurs.' }
  }

  const { data: delivery, error: deliveryError } = await supabase
    .from('deliveries')
    .select('id, status, order_id')
    .eq('id', parsed.data.deliveryId)
    .eq('courier_id', user.id)
    .eq('company_id', profile.company_id)
    .single()

  if (deliveryError || !delivery) {
    return { error: 'Livraison introuvable ou non attribuée à votre compte.' }
  }

  if (parsed.data.status === 'in_transit') {
    if (!['assigned', 'packed', 'confirmed'].includes(delivery.status)) {
      return { error: 'Cette livraison n\'est plus au statut attribuée.' }
    }

    const { data: activeDelivery } = await supabase
      .from('deliveries')
      .select('id')
      .eq('courier_id', user.id)
      .eq('company_id', profile.company_id)
      .eq('status', 'in_transit')
      .limit(1)
      .maybeSingle()

    if (activeDelivery) {
      return {
        error:
          'Vous avez déjà une livraison en cours. Terminez-la avant d\'en démarrer une autre.',
      }
    }

    const { error } = await supabase
      .from('deliveries')
      .update({
        status: 'in_transit',
        picked_up_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)
      .eq('courier_id', user.id)
      .eq('company_id', profile.company_id)

    if (error) return { error: 'Impossible de mettre à jour la livraison.' }

    await supabase
      .from('orders')
      .update({ status: 'shipped', updated_at: new Date().toISOString() })
      .eq('id', delivery.order_id)
      .eq('company_id', profile.company_id)
  } else if (parsed.data.status === 'delivered') {
    const { error } = await supabase
      .from('deliveries')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', delivery.id)
      .eq('courier_id', user.id)
      .eq('company_id', profile.company_id)

    if (error) return { error: 'Impossible de valider la livraison.' }

    await supabase
      .from('orders')
      .update({
        status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.order_id)
      .eq('company_id', profile.company_id)
  } else {
    const reason = parsed.data.failedReason ?? ''
    const { error: updateError } = await supabase
      .from('deliveries')
      .update({
        status: 'failed',
        failed_reason: reason,
      })
      .eq('id', delivery.id)
      .eq('courier_id', user.id)
      .eq('company_id', profile.company_id)

    if (updateError) return { error: 'Impossible d\'enregistrer l\'échec.' }

    await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        notes: reason ? `[ÉCHEC/REPORT: ${reason}]` : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.order_id)
      .eq('company_id', profile.company_id)

    const { error: proofError } = await supabase
      .from('delivery_proofs')
      .insert({
        company_id: profile.company_id,
        delivery_id: delivery.id,
        notes: reason,
      })

    if (proofError) return { error: 'Échec enregistré mais preuve non sauvegardée.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/payments')
  revalidatePath('/mes-livraisons')
  return { success: true }
}

export async function completeCourierDelivery(rawData: CompleteDeliveryInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const parsed = completeDeliverySchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'courier') {
    return { error: 'Espace réservé aux livreurs.' }
  }

  // 1. Récupération de l'ordre concerné
  const { data: deliveryRow } = await supabase
    .from('deliveries')
    .select('id, order_id')
    .eq('id', parsed.data.deliveryId)
    .maybeSingle()

  const targetOrderId = deliveryRow?.order_id

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'complete_courier_delivery',
    {
      p_delivery_id: parsed.data.deliveryId,
      p_outcome: parsed.data.outcome,
      p_collected_amount:
        parsed.data.outcome === 'delivered' ? parsed.data.collectedAmount : null,
      p_payment_mode:
        parsed.data.outcome === 'delivered' ? parsed.data.paymentMode : null,
      p_failure_reason:
        parsed.data.outcome === 'failed' ? parsed.data.failureReason : null,
      p_comment:
        parsed.data.outcome === 'failed' ? (parsed.data.comment || null) : null,
      p_recipient_name:
        parsed.data.outcome === 'delivered' ? (parsed.data.recipientName || null) : null,
      p_photo_url:
        parsed.data.outcome === 'delivered' ? (parsed.data.photoUrl || null) : null,
    }
  )

  if (rpcError) {
    console.warn('RPC complete_courier_delivery repli:', rpcError.message)
    if (parsed.data.outcome === 'delivered') {
      await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.deliveryId)
    } else {
      await supabase
        .from('deliveries')
        .update({
          status: 'failed',
          failed_reason: parsed.data.failureReason || 'Échec de livraison',
        })
        .eq('id', parsed.data.deliveryId)
    }
  }

  // 2. Forcer systématiquement la mise à jour de la table orders
  if (targetOrderId) {
    if (parsed.data.outcome === 'delivered') {
      await supabase
        .from('orders')
        .update({
          status: 'delivered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetOrderId)
    } else if (parsed.data.outcome === 'failed') {
      const reason = parsed.data.failureReason || parsed.data.comment || 'Échec de livraison'
      await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          notes: `[ÉCHEC/REPORT: ${reason}]`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetOrderId)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/payments')
  revalidatePath('/mes-livraisons')
  return { success: true as const }
}

export async function restockReturnedDelivery(deliveryId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'owner' && profile.role !== 'employee') {
    return { error: 'Action non autorisée.' }
  }

  const { data: delivery, error: fetchErr } = await supabase
    .from('deliveries')
    .select('id, order_id, status, notes, orders(id, order_items(product_name, quantity))')
    .eq('id', deliveryId)
    .eq('company_id', profile.company_id)
    .single()

  if (fetchErr || !delivery) {
    return { error: 'Livraison introuvable.' }
  }

  if ((delivery.notes || '').includes('[STOCK RÉINTÉGRÉ]')) {
    return { success: true as const }
  }

  // Réintégrer les articles correspondants dans le catalogue produits
  const orderObj: any = Array.isArray(delivery.orders) ? delivery.orders[0] : delivery.orders
  const orderItems: Array<{ product_name: string; quantity: number }> = orderObj?.order_items ?? []

  for (const item of orderItems) {
    const baseName = item.product_name.replace(/\s*\([^)]+\)\s*$/, '').trim()
    if (!baseName) continue

    const { data: matchedProduct } = await supabase
      .from('products')
      .select('id, is_active')
      .eq('company_id', profile.company_id)
      .ilike('name', baseName)
      .limit(1)
      .maybeSingle()

    if (matchedProduct) {
      // Réactiver le produit et tenter d'incrémenter stock_quantity si présent
      const { data: stockRow, error: stockSelectErr } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', matchedProduct.id)
        .maybeSingle()

      if (!stockSelectErr && stockRow && typeof (stockRow as any).stock_quantity === 'number') {
        const nextQty = Number((stockRow as any).stock_quantity) + Number(item.quantity || 1)
        await supabase
          .from('products')
          .update({ stock_quantity: nextQty, is_active: true })
          .eq('id', matchedProduct.id)
      } else {
        await supabase
          .from('products')
          .update({ is_active: true })
          .eq('id', matchedProduct.id)
      }
    }
  }

  const existingNotes = (delivery.notes || '').trim()
  const nextNotes = existingNotes ? `${existingNotes} | [STOCK RÉINTÉGRÉ]` : '[STOCK RÉINTÉGRÉ]'

  await supabase
    .from('deliveries')
    .update({
      notes: nextNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', delivery.id)
    .eq('company_id', profile.company_id)

  if (delivery.order_id) {
    await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', delivery.order_id)
      .eq('company_id', profile.company_id)
  }

  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')

  return { success: true as const }
}
