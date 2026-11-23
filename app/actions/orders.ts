'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { assertStoreNotSuspended } from '@/lib/supabase/store-status'
import { getLomeDayStartIso } from '@/lib/utils/lome-time'
import {
  createOrderSchema,
  updateOrderStatusSchema,
  type CreateOrderInput,
  type OrderStatus,
} from '@/lib/validations/orders'

function formatProductName(item: CreateOrderInput['items'][number]) {
  const details: string[] = []
  if (item.size) details.push(`Taille: ${item.size}`)
  if (item.color) details.push(`Couleur: ${item.color}`)
  return details.length > 0
    ? `${item.description} (${details.join(', ')})`
    : item.description
}

/**
 * Calcule le prochain numéro de colis séquentiel (#01, #02, #03...) de façon atomique
 * via PostgreSQL get_next_daily_parcel_number, ou par SELECT MAX sans filtre restrictif
 * pour garantir l'incrémentation stricte même si la colonne SQL n'a pas encore été créée.
 */
export async function getNextDailyParcelNumber(supabase: any, companyId: string): Promise<string> {
  // 1. Appel RPC atomique PostgreSQL (si migration appliquée)
  try {
    const { data: rpcNum, error: rpcErr } = await supabase.rpc('get_next_daily_parcel_number', {
      p_company_id: companyId,
    })
    if (!rpcErr && rpcNum && typeof rpcNum === 'string' && rpcNum.startsWith('#')) {
      return rpcNum
    }
  } catch {
    // Si la fonction SQL n'est pas encore créée en base, repli TypeScript
  }

  // 2. SELECT MAX pur sur la table orders
  try {
    let allOrders: Array<{ parcel_number?: string | null; notes?: string | null }> = []

    const { data: ordersWithCol, error: colErr } = await supabase
      .from('orders')
      .select('parcel_number, notes')
      .eq('company_id', companyId)

    if (!colErr && ordersWithCol) {
      allOrders = ordersWithCol
    } else {
      // Repli si la colonne parcel_number n'existe pas encore en base : inspection des notes
      const { data: notesOrders } = await supabase
        .from('orders')
        .select('notes')
        .eq('company_id', companyId)

      allOrders = notesOrders ?? []
    }

    const nums: number[] = []
    for (const o of allOrders) {
      if (o.parcel_number) {
        const val = parseInt(String(o.parcel_number).replace(/\D/g, ''), 10)
        if (!isNaN(val) && val > 0) nums.push(val)
      }
      if (o.notes) {
        const match = String(o.notes).match(/#(\d+)/)
        if (match) {
          const val = parseInt(match[1], 10)
          if (!isNaN(val) && val > 0) nums.push(val)
        }
      }
    }

    const nextVal = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `#${String(nextVal).padStart(2, '0')}`
  } catch (err) {
    console.warn('Erreur calcul repli parcel_number:', err)
    return '#01'
  }
}

/**
 * Vérifie s'il existe déjà une commande pour ce client aujourd'hui (groupage de commandes)
 */
export async function checkExistingDailyOrderByPhone(phone: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { hasExistingOrder: false }
    }

    const profile = await getOrCreateProfile(supabase, user)
    if (profile.profileMissing || !profile.company_id) {
      return { hasExistingOrder: false }
    }

    const cleanDigits = phone.replace(/\D/g, '')
    const last8 = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : cleanDigits
    if (last8.length < 8) {
      return { hasExistingOrder: false }
    }

    const todayStartIso = getLomeDayStartIso()

    // Recherche des clients de l'entreprise dont le numéro correspond aux 8 derniers chiffres
    const { data: customers } = await supabase
      .from('customers')
      .select('id, phone, full_name')
      .eq('company_id', profile.company_id)

    const matchingCustomers = (customers || []).filter((c) => {
      const pDigits = (c.phone || '').replace(/\D/g, '')
      return pDigits.endsWith(last8)
    })

    if (matchingCustomers.length === 0) {
      return { hasExistingOrder: false }
    }

    const customerIds = matchingCustomers.map((c) => c.id)

    const { data: orders } = await supabase
      .from('orders')
      .select('id, parcel_number, status, created_at, ordered_at, delivery_fee')
      .eq('company_id', profile.company_id)
      .in('customer_id', customerIds)
      .gte('created_at', todayStartIso)
      .in('status', ['pending_confirmation', 'confirmed', 'packed', 'pending'])

    if (orders && orders.length > 0) {
      const parcelNumbers = orders
        .map((o) => o.parcel_number)
        .filter(Boolean) as string[]
      return {
        hasExistingOrder: true,
        existingOrdersCount: orders.length,
        existingParcelNumbers: parcelNumbers,
        customerName: matchingCustomers[0]?.full_name,
      }
    }

    return { hasExistingOrder: false }
  } catch (err) {
    console.warn('Erreur vérification commande existante client:', err)
    return { hasExistingOrder: false }
  }
}

export async function createOrder(rawData: CreateOrderInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const parsed = createOrderSchema.safeParse(rawData)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return {
      error: firstIssue.message,
      field: firstIssue.path.join('.'),
    }
  }

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.profileMissing || !profile.company_id) {
    return {
      error:
        'Profil ou tables SQL manquants dans Supabase. Exécutez supabase/migrations/000_full_setup.sql dans SQL Editor.',
    }
  }

  if (profile.role === 'courier') {
    return { error: 'Action non autorisée pour ce rôle.' }
  }

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) {
    return { error: subCheck.error }
  }

  const input = parsed.data
  let customerId = input.customerId || ''
  let newCustomerRow: { id: string; full_name: string; phone: string } | null = null

  let customerFullName = ''
  let customerPhone = ''
  let customerCityOrAddress = ''

  if (input.customerMode === 'new' && input.newCustomer) {
    const rawPhone = input.newCustomer.phone.trim()
    const cleanDigits = rawPhone.replace(/\D/g, '')
    const normalizedPhone =
      cleanDigits.length === 8
        ? `+228 ${cleanDigits.slice(0, 2)} ${cleanDigits.slice(2, 4)} ${cleanDigits.slice(4, 6)} ${cleanDigits.slice(6, 8)}`
        : rawPhone

    customerFullName = input.newCustomer.fullName.trim()
    customerPhone = normalizedPhone
    customerCityOrAddress = input.newCustomer.city?.trim() || ''

    // Rechercher d'abord une fiche cliente existante par téléphone (CRM auto-match)
    const { data: matchedCustomer } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .eq('company_id', profile.company_id)
      .eq('phone', normalizedPhone)
      .maybeSingle()

    if (matchedCustomer) {
      await supabase
        .from('customers')
        .update({
          full_name: customerFullName || matchedCustomer.full_name,
          city: customerCityOrAddress || undefined,
        })
        .eq('id', matchedCustomer.id)

      customerId = matchedCustomer.id
      newCustomerRow = {
        id: matchedCustomer.id,
        full_name: customerFullName || matchedCustomer.full_name,
        phone: normalizedPhone,
      }
    } else {
      const { data: createdCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          company_id: profile.company_id,
          full_name: customerFullName,
          phone: normalizedPhone,
          city: customerCityOrAddress || null,
        })
        .select('id, full_name, phone')
        .single()

      if (customerError || !createdCustomer) {
        return { error: 'Impossible de créer le client.' }
      }
      customerId = createdCustomer.id
      newCustomerRow = createdCustomer
    }
  } else {
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('id, full_name, phone, city, address')
      .eq('id', customerId)
      .eq('company_id', profile.company_id)
      .single()

    if (checkError || !existingCustomer) {
      return { error: 'Client introuvable pour votre entreprise.' }
    }
    customerFullName = existingCustomer.full_name || ''
    customerPhone = existingCustomer.phone || ''
    customerCityOrAddress = existingCustomer.city || existingCustomer.address || ''
  }

  // Contrôle strict de complétude côté Backend
  const missingReasons: string[] = []
  if (!customerFullName.trim()) missingReasons.push('Nom manquant')
  if (!customerPhone.trim()) missingReasons.push('Téléphone manquant')
  if (!customerCityOrAddress.trim()) missingReasons.push('Quartier non précisé')

  const itemsMissingDetails = input.items.some(
    (item) => !item.color?.trim() || !item.size?.trim() || !item.description?.trim()
  )
  if (itemsMissingDetails) {
    missingReasons.push('Couleur ou taille non précisée')
  }

  const itemsSubtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )
  const serverTotalAmount = Math.max(
    0,
    Math.round((itemsSubtotal + input.deliveryFee - input.discount) * 100) / 100
  )

  const noteParts: string[] = []
  if (input.discount > 0) {
    noteParts.push(`Réduction appliquée : ${input.discount.toLocaleString('fr-FR')} FCFA`)
  }
  if (input.notes && !input.notes.includes('[INFO MANQUANTE:')) {
    noteParts.push(input.notes)
  } else if (input.notes) {
    const cleaned = input.notes.replace(/\|?\s*\[INFO MANQUANTE:[^\]]+\]/g, '').trim()
    if (cleaned) noteParts.push(cleaned)
  }

  if (missingReasons.length > 0) {
    noteParts.push(`[INFO MANQUANTE: ${missingReasons.join(', ')}]`)
  }

  // Statut initial : forcer 'pending_confirmation' si des informations manquent
  const requestedStatus =
    missingReasons.length > 0
      ? 'pending_confirmation'
      : input.status || 'pending_confirmation'

  // Si 'confirmed', on génère le numéro de colis
  let initialParcelNumber: string | null = null
  if (requestedStatus === 'confirmed') {
    initialParcelNumber = await getNextDailyParcelNumber(supabase, profile.company_id)
  }

  // Tentative 1 d'insertion avec le statut demandé et parcel_number (si la migration 010 est passée)
  let createdOrder: { id: string } | null = null
  let orderError: any = null

  const insertPayloadWithParcel: Record<string, any> = {
    company_id: profile.company_id,
    customer_id: customerId,
    created_by: user.id,
    status: requestedStatus,
    parcel_number: initialParcelNumber,
    total_amount: serverTotalAmount,
    delivery_fee: input.deliveryFee,
    notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
  }

  const res1 = await supabase
    .from('orders')
    .insert(insertPayloadWithParcel)
    .select('id')
    .single()

  if (!res1.error && res1.data) {
    createdOrder = res1.data
  } else {
    console.warn('Tentative 1 createOrder échouée (status/parcel):', res1.error?.message)
    // Tentative 2 de repli : Si le statut 'pending_confirmation' n'est pas encore dans l'enum SQL
    // ou si 'parcel_number' n'existe pas encore en base distante, on essaie avec status standard 'pending'
    const insertPayloadFallbackStatus: Record<string, any> = {
      company_id: profile.company_id,
      customer_id: customerId,
      created_by: user.id,
      status: requestedStatus === 'pending_confirmation' ? 'pending' : requestedStatus,
      parcel_number: initialParcelNumber,
      total_amount: serverTotalAmount,
      delivery_fee: input.deliveryFee,
      notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
    }

    const res2 = await supabase
      .from('orders')
      .insert(insertPayloadFallbackStatus)
      .select('id')
      .single()

    if (!res2.error && res2.data) {
      createdOrder = res2.data
    } else {
      console.warn('Tentative 2 createOrder échouée (sans enum custom):', res2.error?.message)
      // Tentative 3 de repli maximal : sans colonne parcel_number (si la colonne SQL n'a pas encore été créée dans Supabase)
      // On stocke le numéro de colis dans les notes pour garantir la persistance immédiate sans bloquer !
      const notesWithFallbackParcel = initialParcelNumber
        ? [initialParcelNumber, ...noteParts].join(' | ')
        : (noteParts.length > 0 ? noteParts.join(' | ') : null)

      const insertPayloadLegacy: Record<string, any> = {
        company_id: profile.company_id,
        customer_id: customerId,
        created_by: user.id,
        status: 'pending',
        total_amount: serverTotalAmount,
        delivery_fee: input.deliveryFee,
        notes: notesWithFallbackParcel,
      }

      const res3 = await supabase
        .from('orders')
        .insert(insertPayloadLegacy)
        .select('id')
        .single()

      if (!res3.error && res3.data) {
        createdOrder = res3.data
      } else {
        orderError = res3.error || res2.error || res1.error
        console.error('Erreur createOrder détaillée finale:', orderError)
      }
    }
  }

  if (orderError || !createdOrder) {
    return {
      error: orderError?.message
        ? `Erreur lors de la création de la commande : ${orderError.message}`
        : 'Erreur lors de la création de la commande.',
    }
  }

  const orderItemsPayload = input.items.map((item) => ({
    company_id: profile.company_id,
    order_id: createdOrder.id,
    product_name: formatProductName(item),
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload)

  if (itemsError) {
    await supabase
      .from('orders')
      .delete()
      .eq('id', createdOrder.id)
      .eq('company_id', profile.company_id)
    return { error: 'Erreur lors de l\'enregistrement des articles.' }
  }

  // Enregistrement d'un éventuel paiement immédiat à la boutique (intégral ou partiel)
  if (input.payment && input.payment.type !== 'none' && input.payment.amount > 0) {
    const rawPaid = input.payment.amount
    const paidAmount = Math.min(serverTotalAmount, Math.round(rawPaid * 100) / 100)

    const methodMapping: Record<string, string> = {
      'Espèces': 'cash',
      'Flooz': 'mobile_money',
      'Mixx': 'mobile_money',
      'Virement': 'bank_transfer',
      'Autre': 'cash',
    }
    const sqlMethod = methodMapping[input.payment.method] || 'cash'
    const refText = [
      `Boutique: ${input.payment.method}`,
      input.payment.reference ? `Réf: ${input.payment.reference}` : '',
      paidAmount >= serverTotalAmount ? 'Paiement intégral' : 'Acompte partiel',
    ]
      .filter(Boolean)
      .join(' | ')

    const { error: payError } = await supabase.from('payments').insert({
      company_id: profile.company_id,
      order_id: createdOrder.id,
      amount: paidAmount,
      method: sqlMethod,
      status: 'completed',
      reference: refText,
      paid_at: new Date().toISOString(),
    })

    if (payError) {
      console.error('Erreur insertion paiement boutique:', payError)
    }
  }

  // Auto-assignation mono-livreur dès la création si commande complète et un seul livreur actif
  if (missingReasons.length === 0) {
    const { data: activeCouriers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', profile.company_id)
      .eq('role', 'courier')
      .eq('is_active', true)

    if (activeCouriers && activeCouriers.length === 1) {
      const soleCourier = activeCouriers[0]
      const { data: custRow } = await supabase
        .from('customers')
        .select('city, address')
        .eq('id', customerId)
        .maybeSingle()

      const addr = [custRow?.city, custRow?.address].filter(Boolean).join(', ') || 'À livrer'
      const nowIso = new Date().toISOString()

      await supabase.from('deliveries').insert({
        company_id: profile.company_id,
        order_id: createdOrder.id,
        courier_id: soleCourier.id,
        status: 'in_transit',
        delivery_address: addr,
        scheduled_at: nowIso,
        picked_up_at: nowIso,
      })

      const existingNotes = noteParts.length > 0 ? noteParts.join(' | ') : ''
      const courierTag = `[LIVREUR: ${soleCourier.full_name}]`
      const nextNotes = existingNotes ? `${existingNotes} | ${courierTag}` : courierTag
      await supabase
        .from('orders')
        .update({ notes: nextNotes })
        .eq('id', createdOrder.id)
        .eq('company_id', profile.company_id)
    }
  }

  const { data: fullOrder } = await supabase
    .from('orders')
    .select(`
      id,
      parcel_number,
      status,
      total_amount,
      delivery_fee,
      notes,
      ordered_at,
      customers(full_name, phone, city, address),
      order_items(id, product_name, quantity, unit_price, subtotal),
      deliveries(id, status, courier_id, delivery_address, profiles(full_name, phone)),
      payments(id, amount, method, status, reference, paid_at)
    `)
    .eq('id', createdOrder.id)
    .single()

  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/clients')
  revalidatePath('/dashboard/payments')
  revalidatePath('/mes-livraisons')
  revalidatePath('/paiements')
  revalidatePath('/dashboard')
  revalidatePath('/commandes')
  return {
    success: true as const,
    orderId: createdOrder.id,
    order: fullOrder,
    createdCustomer: newCustomerRow,
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const parsed = updateOrderStatusSchema.safeParse({ orderId, status })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const profile = await getOrCreateProfile(supabase, user)

  if (profile.profileMissing || !profile.company_id || profile.role === 'courier') {
    return { error: 'Action non autorisée.' }
  }

  const updates: { status: OrderStatus; parcel_number?: string } = {
    status: parsed.data.status,
  }

  // Si on passe à 'confirmed' ou 'packed', veiller à générer un parcel_number si manquant
  if (parsed.data.status === 'confirmed' || parsed.data.status === 'packed') {
    try {
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('parcel_number')
        .eq('id', parsed.data.orderId)
        .eq('company_id', profile.company_id)
        .maybeSingle()

      if (currentOrder && !currentOrder.parcel_number) {
        updates.parcel_number = await getNextDailyParcelNumber(supabase, profile.company_id)
      }
    } catch {
      // Ignorer si la colonne n'est pas encore migrée
    }
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', parsed.data.orderId)
    .eq('company_id', profile.company_id)

  if (error) {
    return { error: 'Impossible de mettre à jour le statut.' }
  }

  revalidatePath('/dashboard/orders')
  revalidatePath('/commandes')
  return { success: true }
}

export async function confirmOrder(orderId: string) {
  console.log('Action confirmOrder déclenchée pour:', orderId)
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id || profile.role === 'courier') {
    return { error: 'Action non autorisée.' }
  }

  // 1. Récupérer le company_id et les données de la commande
  let order: { id: string; status: string; parcel_number?: string | null; notes?: string | null; company_id: string } | null = null

  const { data: fullOrderData, error: fullOrderErr } = await supabase
    .from('orders')
    .select('id, company_id, parcel_number, notes, status')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .maybeSingle()

  if (!fullOrderErr && fullOrderData) {
    order = fullOrderData
  } else {
    // Repli au cas où la colonne parcel_number n'est pas encore migrée
    const { data: fallbackOrderData, error: fallbackOrderErr } = await supabase
      .from('orders')
      .select('id, company_id, notes, status')
      .eq('id', orderId)
      .eq('company_id', profile.company_id)
      .maybeSingle()

    if (fallbackOrderErr || !fallbackOrderData) {
      console.error('Erreur récupération confirmOrder:', fallbackOrderErr?.message || fullOrderErr?.message)
      return { error: 'Commande introuvable.' }
    }
    order = fallbackOrderData
  }

  if (order.status === 'cancelled') {
    return { error: 'Impossible de confirmer une commande annulée.' }
  }

  // Si un numéro est déjà attribué et la commande déjà confirmée, ne pas le modifier !
  if (order.parcel_number && order.status === 'confirmed') {
    return { success: true, parcelNumber: order.parcel_number }
  }

  // 2. Calculer le prochain numéro de colis
  let parcelToAssign = order.parcel_number
  if (!parcelToAssign) {
    parcelToAssign = await getNextDailyParcelNumber(supabase, order.company_id)
  }

  console.log('Attribution parcel_number pour commande', orderId, ':', parcelToAssign)

  // Traçabilité des notes
  const currentNotes = order.notes || ''
  const updatedNotes = currentNotes.includes('#')
    ? currentNotes.replace(/#\d+/, parcelToAssign)
    : (currentNotes ? `${parcelToAssign} | ${currentNotes}` : parcelToAssign)

  // 3. Mettre à jour la commande
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'confirmed',
      parcel_number: parcelToAssign,
      notes: updatedNotes,
    })
    .eq('id', orderId)
    .eq('company_id', profile.company_id)

  if (updateError) {
    console.warn('Tentative confirmOrder avec parcel_number échouée, repli sans colonne:', updateError.message)
    const { error: fallbackErr } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        notes: updatedNotes,
      })
      .eq('id', orderId)
      .eq('company_id', profile.company_id)

    if (fallbackErr) {
      console.error('Erreur confirmOrder fallback:', fallbackErr.message)
      return { error: 'Impossible de confirmer la commande.' }
    }
  }

  revalidatePath('/dashboard/orders')
  revalidatePath('/commandes')
  revalidatePath('/dashboard/clients')
  revalidatePath('/dashboard/customers')
  revalidatePath('/dashboard/products')
  revalidatePath('/dashboard')

  return { success: true, parcelNumber: parcelToAssign }
}

export async function markOrderPacked(orderId: string, courierId?: string | null) {
  console.log('Action markOrderPacked déclenchée pour:', orderId)
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id || profile.role === 'courier') {
    return { error: 'Action non autorisée.' }
  }

  // Récupérer la commande (sélection sécurisée sans forcer parcel_number au cas où non migré)
  let order: { id: string; status: string; parcel_number?: string | null; notes?: string | null; company_id: string } | null = null

  const { data: fullOrderData, error: fullOrderErr } = await supabase
    .from('orders')
    .select('id, status, parcel_number, notes, company_id')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .maybeSingle()

  if (!fullOrderErr && fullOrderData) {
    order = fullOrderData
  } else {
    const { data: fallbackOrderData, error: fallbackOrderErr } = await supabase
      .from('orders')
      .select('id, status, notes, company_id')
      .eq('id', orderId)
      .eq('company_id', profile.company_id)
      .maybeSingle()

    if (fallbackOrderErr || !fallbackOrderData) {
      console.error('Erreur récupération markOrderPacked:', fallbackOrderErr?.message || fullOrderErr?.message)
      return { error: 'Commande introuvable.' }
    }
    order = fallbackOrderData
  }

  if (order.status === 'cancelled' || order.status === 'delivered') {
    return { error: 'Statut incompatible pour l\'emballage du colis.' }
  }

  // S'assurer qu'un parcel_number existe (sinon le générer) et résoudre les collisions
  let parcelNumber = order.parcel_number
  let needsNewNumber = !parcelNumber
  if (parcelNumber) {
    const { data: duplicateCheck } = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('parcel_number', parcelNumber)
      .neq('id', orderId)
      .limit(1)

    if (duplicateCheck && duplicateCheck.length > 0) {
      needsNewNumber = true
    }
  }

  if (needsNewNumber) {
    parcelNumber = await getNextDailyParcelNumber(supabase, profile.company_id)
  }

  // Traçabilité note au cas où
  const currentNotes = order.notes || ''
  const updatedNotes = currentNotes.includes('#')
    ? currentNotes
    : (currentNotes ? `${parcelNumber} | ${currentNotes}` : parcelNumber)

  // 1. Mise à jour de la commande : statut 'packed'
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'packed',
      parcel_number: parcelNumber,
      notes: updatedNotes,
    })
    .eq('id', orderId)
    .eq('company_id', profile.company_id)

  if (updateError) {
    console.warn('Tentative markOrderPacked avec packed/parcel échouée:', updateError.message)
    // Tentative 2 : statut 'packed' sans colonne parcel_number (au cas où la colonne n'est pas migrée)
    const { error: fallbackErr1 } = await supabase
      .from('orders')
      .update({
        status: 'packed',
        notes: updatedNotes,
      })
      .eq('id', orderId)
      .eq('company_id', profile.company_id)

    if (fallbackErr1) {
      console.warn('Tentative status packed refusée par contrainte enum SQL:', fallbackErr1.message)
      // Tentative 3 : repli avec [EMBALLÉ] dans les notes
      const packedNotes = `[EMBALLÉ] ${updatedNotes}`
      const { error: fallbackErr2 } = await supabase
        .from('orders')
        .update({
          status: 'preparing',
          notes: packedNotes,
        })
        .eq('id', orderId)
        .eq('company_id', profile.company_id)

      if (fallbackErr2) {
        console.error('Erreur finale markOrderPacked:', fallbackErr2.message)
        return { error: 'Impossible de marquer la commande comme emballée.' }
      }
    }
  }

  // 2. Auto-assignation si mono-livreur ou utilisation du livreur choisi
  let effectiveCourierId = courierId || null
  if (!effectiveCourierId) {
    const { data: activeCouriers } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('role', 'courier')
      .eq('is_active', true)

    if (activeCouriers && activeCouriers.length === 1) {
      effectiveCourierId = activeCouriers[0].id
    }
  }

  let assignedDeliveryData = null
  if (effectiveCourierId) {
    const { data: courierRow } = await supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', effectiveCourierId)
      .maybeSingle()

    const courierFullName = courierRow?.full_name || 'Livreur'

    // Mise à jour de la note et du statut de la commande pour traçabilité infaillible
    const baseNotes = updatedNotes || ''
    const courierNote = `[LIVREUR: ${courierFullName}]`
    const finalNotes = baseNotes.includes('[LIVREUR:')
      ? baseNotes.replace(/\[LIVREUR:[^\]]+\]/, courierNote)
      : baseNotes
        ? `${baseNotes} | ${courierNote}`
        : courierNote

    await supabase
      .from('orders')
      .update({
        status: 'assigned',
        notes: finalNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('company_id', profile.company_id)

    // Vérifier si une livraison existe déjà pour cette commande
    const { data: existingDelivery } = await supabase
      .from('deliveries')
      .select('id, delivery_address')
      .eq('order_id', orderId)
      .eq('company_id', profile.company_id)
      .maybeSingle()

    // Récupérer l'adresse de livraison depuis le client si nécessaire
    const { data: orderCustomer } = await supabase
      .from('orders')
      .select('customer_id, customers(address, city)')
      .eq('id', orderId)
      .single()

    const rawCust: any = orderCustomer?.customers
    const clientCity = Array.isArray(rawCust) ? rawCust[0]?.city : rawCust?.city
    const clientAddress = Array.isArray(rawCust) ? rawCust[0]?.address : rawCust?.address
    const clientAddr = [clientCity, clientAddress].filter(Boolean).join(', ')
    const finalAddress = existingDelivery?.delivery_address || clientAddr || 'À livrer'
    const nowIso = new Date().toISOString()

    if (existingDelivery) {
      let { data: updatedDelivery, error: dUpdateErr } = await supabase
        .from('deliveries')
        .update({
          courier_id: effectiveCourierId,
          courier_name: courierFullName,
          status: 'in_transit',
          delivery_address: finalAddress,
          scheduled_at: nowIso,
          picked_up_at: nowIso,
        })
        .eq('id', existingDelivery.id)
        .select('id, status, courier_id, delivery_address, profiles(full_name, phone)')
        .single()

      if (dUpdateErr) {
        const retry = await supabase
          .from('deliveries')
          .update({
            courier_id: effectiveCourierId,
            status: 'in_transit',
            delivery_address: finalAddress,
            scheduled_at: nowIso,
            picked_up_at: nowIso,
          })
          .eq('id', existingDelivery.id)
          .select('id, status, courier_id, delivery_address, profiles(full_name, phone)')
          .single()
        updatedDelivery = retry.data
        dUpdateErr = retry.error
      }

      if (!dUpdateErr && updatedDelivery) {
        assignedDeliveryData = {
          id: updatedDelivery.id,
          status: updatedDelivery.status,
          courier_id: updatedDelivery.courier_id,
          delivery_address: updatedDelivery.delivery_address,
          profiles: {
            full_name: courierFullName,
            phone: courierRow?.phone ?? null,
          },
        }
      }
    } else {
      let { data: newDelivery, error: dInsertErr } = await supabase
        .from('deliveries')
        .insert({
          company_id: profile.company_id,
          order_id: orderId,
          courier_id: effectiveCourierId,
          courier_name: courierFullName,
          status: 'in_transit',
          delivery_address: finalAddress,
          scheduled_at: nowIso,
          picked_up_at: nowIso,
        })
        .select('id, status, courier_id, delivery_address')
        .single()

      if (dInsertErr) {
        const retry = await supabase
          .from('deliveries')
          .insert({
            company_id: profile.company_id,
            order_id: orderId,
            courier_id: effectiveCourierId,
            status: 'in_transit',
            delivery_address: finalAddress,
            scheduled_at: nowIso,
            picked_up_at: nowIso,
          })
          .select('id, status, courier_id, delivery_address')
          .single()
        newDelivery = retry.data
        dInsertErr = retry.error
      }

      if (!dInsertErr && newDelivery) {
        assignedDeliveryData = {
          id: newDelivery.id,
          status: newDelivery.status,
          courier_id: newDelivery.courier_id,
          delivery_address: newDelivery.delivery_address,
          profiles: {
            full_name: courierFullName,
            phone: courierRow?.phone ?? null,
          },
        }
      }
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/payments')
  revalidatePath('/mes-livraisons')

  return {
    success: true,
    parcelNumber,
    orderStatus: (effectiveCourierId ? 'assigned' : 'packed') as 'assigned' | 'packed',
    delivery: assignedDeliveryData,
  }
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id || profile.role === 'courier') {
    return { error: 'Action non autorisée.' }
  }

  // Vérifier la commande
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('company_id', profile.company_id)
    .single()

  if (orderErr || !order) {
    return { error: 'Commande introuvable.' }
  }

  if (order.status === 'delivered') {
    return { error: 'Impossible d\'annuler une commande déjà livrée.' }
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('company_id', profile.company_id)

  if (error) {
    return { error: 'Erreur lors de l\'annulation de la commande.' }
  }

  revalidatePath('/dashboard/orders')
  revalidatePath('/commandes')
  revalidatePath('/dashboard/clients')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function archiveOrder(orderId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const profile = await getOrCreateProfile(supabase, user)
  if (!profile.company_id || profile.role === 'courier') {
    return { error: 'Action non autorisée.' }
  }

  const subCheck = await assertStoreNotSuspended(
    supabase,
    user.id,
    profile.company_id
  )
  if (!subCheck.allowed) return { error: subCheck.error }

  const { error } = await supabase
    .from('orders')
    .update({ is_archived: true, status: 'cancelled' })
    .eq('id', orderId)
    .eq('company_id', profile.company_id)

  if (error) {
    await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
      .eq('company_id', profile.company_id)
  }

  revalidatePath('/dashboard/orders')
  revalidatePath('/commandes')
  revalidatePath('/dashboard')
  return { success: true as const }
}
