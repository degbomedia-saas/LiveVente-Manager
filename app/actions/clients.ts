'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { clientSchema } from '@/lib/validations/clients'

/**
 * Server Action — Ajouter un client
 *
 * AGENTS.md checklist :
 * ✅ Authentification vérifiée côté serveur
 * ✅ Validation Zod avant toute logique métier
 * ✅ company_id récupéré côté serveur (jamais fourni par le client)
 * ✅ Vérification du rôle (courier interdit)
 * ✅ Aucun log de données sensibles
 * ✅ Pas de SQL brut — Supabase SDK uniquement
 */
export async function addClient(rawData: {
  fullName: string
  phone: string
  city: string
  address: string
}) {
  const supabase = await createClient()

  // 1. Vérifier l'authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  // 2. Validation Zod AVANT toute logique métier
  const result = clientSchema.safeParse(rawData)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return { error: firstError.message, field: firstError.path[0] as string }
  }

  // 3. Récupérer company_id et rôle CÔTÉ SERVEUR (jamais depuis le client)
  const profile = await getOrCreateProfile(supabase, user)

  if (profile.profileMissing || !profile.company_id) {
    return {
      error:
        'Profil ou tables SQL manquants dans Supabase. Exécutez supabase/migrations/000_full_setup.sql dans SQL Editor.',
    }
  }

  // 4. Vérifier les permissions (les livreurs ne peuvent pas gérer les clients)
  if (profile.role === 'courier') {
    return { error: 'Vous n\'avez pas les permissions nécessaires.' }
  }

  // 5. Insertion avec le company_id vérifié côté serveur
  const { error: insertError } = await supabase.from('customers').insert({
    company_id: profile.company_id,       // ✅ AGENTS.md : depuis le serveur
    full_name:  result.data.fullName,
    phone:      result.data.phone,
    city:       result.data.city || null,
    address:    result.data.address || null,
  })

  if (insertError) {
    return { error: 'Erreur lors de l\'enregistrement. Veuillez réessayer.' }
  }

  // Revalide la page pour afficher le nouveau client
  revalidatePath('/dashboard/clients')
  return { success: true }
}

/**
 * Server Action — Supprimer un client
 */
export async function deleteClient(clientId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Non authentifié.' }

  // Vérifier le rôle
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'owner') {
    return { error: 'Seul le propriétaire peut supprimer un client.' }
  }

  // La RLS garantit que seuls les clients de l'entreprise sont supprimables
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', clientId)

  if (error) return { error: 'Erreur lors de la suppression.' }

  revalidatePath('/dashboard/clients')
  return { success: true }
}

export interface CustomerOrderHistoryItem {
  id: string
  orderNumber: string
  orderedAt: string
  status: string
  totalAmount: number
  amountPaid: number
  remainingAmount: number
  paymentStatus: 'paid' | 'partial' | 'unpaid'
  items: {
    id: string
    productName: string
    quantity: number
    unitPrice: number
    subtotal: number
  }[]
  delivery?: {
    id: string
    status: string
    courierName: string | null
    courierPhone: string | null
    deliveryAddress: string | null
    proof?: {
      recipientName: string | null
      photoUrl: string | null
      notes: string | null
      completedAt: string | null
    } | null
  } | null
}

export interface CustomerMetrics {
  totalOrders: number
  totalSpent: number
  activeOrders: number
  deliveredOrders: number
  cancelledOrders: number
}

export interface CustomerOrderHistoryResult {
  orders: CustomerOrderHistoryItem[]
  metrics: CustomerMetrics
}

/**
 * Server Action — Récupérer l'historique complet des commandes d'un client
 *
 * AGENTS.md checklist :
 * ✅ Authentification vérifiée côté serveur
 * ✅ company_id vérifié côté serveur
 * ✅ Vérification du rôle (courier interdit d'accéder aux données globales clients)
 * ✅ Pas de fuite de données inter-entreprises
 */
export async function getCustomerOrderHistory(customerId: string): Promise<{
  data?: CustomerOrderHistoryResult
  error?: string
}> {
  if (!customerId) {
    return { error: 'Identifiant client requis.' }
  }

  const supabase = await createClient()

  // 1. Authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  // 2. Profil & company_id côté serveur
  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Entreprise non identifiée.' }
  }

  if (profile.role === 'courier') {
    return { error: 'Accès non autorisé.' }
  }

  // 3. Vérification de l'appartenance du client à l'entreprise
  const { data: customer, error: customerErr } = await supabase
    .from('customers')
    .select('id, company_id')
    .eq('id', customerId)
    .eq('company_id', profile.company_id)
    .single()

  if (customerErr || !customer) {
    return { error: 'Client introuvable ou non autorisé.' }
  }

  // 4. Récupérer les commandes du client avec items, livraisons et paiements
  // Note : Requête robuste et tolérante aux jointures
  let rawOrders: any[] | null = null

  const { data: deepOrders, error: deepOrdersErr } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total_amount,
      delivery_fee,
      notes,
      ordered_at,
      order_items(id, product_name, quantity, unit_price, subtotal),
      deliveries(
        id,
        status,
        delivery_address,
        profiles(full_name, phone),
        delivery_proofs(id, photo_url, notes, created_at)
      ),
      payments(id, amount, method, status, reference, paid_at)
    `)
    .eq('customer_id', customerId)
    .eq('company_id', profile.company_id)
    .order('ordered_at', { ascending: false })

  if (deepOrdersErr) {
    console.error('Erreur getCustomerOrderHistory jointure complète:', deepOrdersErr.message)

    // Requête de repli simplifiée sans jointures imbriquées complexes si delivery_proofs ou une relation manque
    const { data: fallbackOrders, error: fallbackOrdersErr } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_amount,
        delivery_fee,
        notes,
        ordered_at,
        order_items(id, product_name, quantity, unit_price, subtotal),
        deliveries(id, status, delivery_address),
        payments(id, amount, method, status, reference, paid_at)
      `)
      .eq('customer_id', customerId)
      .eq('company_id', profile.company_id)
      .order('ordered_at', { ascending: false })

    if (fallbackOrdersErr) {
      console.error('Erreur getCustomerOrderHistory requête de repli:', fallbackOrdersErr.message)

      // Repli ultime : récupérer les commandes seules
      const { data: basicOrders, error: basicOrdersErr } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .eq('company_id', profile.company_id)
        .order('ordered_at', { ascending: false })

      if (basicOrdersErr) {
        console.error('Erreur getCustomerOrderHistory repli basique:', basicOrdersErr.message)
        return { error: 'Erreur lors de la récupération des commandes.' }
      }
      rawOrders = basicOrders || []
    } else {
      rawOrders = fallbackOrders || []
    }
  } else {
    rawOrders = deepOrders || []
  }

  const orders: CustomerOrderHistoryItem[] = (rawOrders || []).map((o: any) => {
    // Calcul des paiements complétés
    const validPayments = (o.payments || []).filter((p: any) => p.status === 'completed')
    const amountPaid = validPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
    const totalAmount = Number(o.total_amount || 0)
    const remainingAmount = Math.max(0, totalAmount - amountPaid)

    let paymentStatus: 'paid' | 'partial' | 'unpaid' = 'unpaid'
    if (totalAmount > 0 && amountPaid >= totalAmount) {
      paymentStatus = 'paid'
    } else if (amountPaid > 0) {
      paymentStatus = 'partial'
    }

    const assignedDelivery = o.deliveries?.[0]
    const deliveryProof = assignedDelivery?.delivery_proofs?.[0]
    const courierProfile = Array.isArray(assignedDelivery?.profiles)
      ? assignedDelivery?.profiles[0]
      : assignedDelivery?.profiles

    return {
      id: o.id,
      orderNumber: `#${o.id.slice(0, 6).toUpperCase()}`,
      orderedAt: o.ordered_at,
      status: o.status,
      totalAmount,
      amountPaid,
      remainingAmount,
      paymentStatus,
      items: (o.order_items || []).map((it: any) => ({
        id: it.id,
        productName: it.product_name,
        quantity: it.quantity,
        unitPrice: Number(it.unit_price || 0),
        subtotal: Number(it.subtotal || 0),
      })),
      delivery: assignedDelivery
        ? {
            id: assignedDelivery.id,
            status: assignedDelivery.status,
            courierName: courierProfile?.full_name ?? null,
            courierPhone: courierProfile?.phone ?? null,
            deliveryAddress: assignedDelivery.delivery_address ?? null,
            proof: deliveryProof
              ? {
                  recipientName: deliveryProof.recipient_name ?? null,
                  photoUrl: deliveryProof.photo_url ?? null,
                  notes: deliveryProof.notes ?? null,
                  completedAt: deliveryProof.created_at ?? null,
                }
              : null,
          }
        : null,
    }
  })

  // 5. Calcul des métriques
  let totalSpent = 0
  let activeOrders = 0
  let deliveredOrders = 0
  let cancelledOrders = 0

  for (const o of orders) {
    if (o.status === 'delivered') {
      deliveredOrders++
      totalSpent += o.totalAmount
    } else if (o.status === 'cancelled') {
      cancelledOrders++
    } else {
      activeOrders++
    }
  }

  const metrics: CustomerMetrics = {
    totalOrders: orders.length,
    totalSpent,
    activeOrders,
    deliveredOrders,
    cancelledOrders,
  }

  return {
    data: {
      orders,
      metrics,
    },
  }
}
