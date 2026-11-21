'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'

export async function resetOperationalDataForTest(): Promise<{
  success?: boolean
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Seul le propriétaire peut réinitialiser les données.' }
  }

  const companyId = profile.company_id

  // 1. Supprimer les reversements de caisse livreurs
  const { error: settlementsErr } = await supabase
    .from('courier_settlements')
    .delete()
    .eq('company_id', companyId)

  if (settlementsErr) {
    return { error: `Erreur purge reversements : ${settlementsErr.message}` }
  }

  // 2. Supprimer les paiements (contrainte ON DELETE RESTRICT sur orders)
  const { error: paymentsErr } = await supabase
    .from('payments')
    .delete()
    .eq('company_id', companyId)

  if (paymentsErr) {
    return { error: `Erreur purge paiements : ${paymentsErr.message}` }
  }

  // 3. Supprimer les livraisons (cascade automatique sur delivery_proofs)
  const { error: deliveriesErr } = await supabase
    .from('deliveries')
    .delete()
    .eq('company_id', companyId)

  if (deliveriesErr) {
    return { error: `Erreur purge livraisons : ${deliveriesErr.message}` }
  }

  // 4. Supprimer les articles de commandes
  const { error: itemsErr } = await supabase
    .from('order_items')
    .delete()
    .eq('company_id', companyId)

  if (itemsErr) {
    return { error: `Erreur purge articles : ${itemsErr.message}` }
  }

  // 5. Supprimer les commandes (remet le compteur quotidien get_next_daily_parcel_number à #01)
  const { error: ordersErr } = await supabase
    .from('orders')
    .delete()
    .eq('company_id', companyId)

  if (ordersErr) {
    return { error: `Erreur purge commandes : ${ordersErr.message}` }
  }

  // 6. Supprimer tous les clients du répertoire
  const { error: customersErr } = await supabase
    .from('customers')
    .delete()
    .eq('company_id', companyId)

  if (customersErr) {
    return { error: `Erreur purge clients : ${customersErr.message}` }
  }

  // 7. Supprimer tous les produits du catalogue
  const { error: productsErr } = await supabase
    .from('products')
    .delete()
    .eq('company_id', companyId)

  if (productsErr) {
    return { error: `Erreur purge produits : ${productsErr.message}` }
  }

  // 8. Mettre à jour le nom officiel de la boutique
  await supabase
    .from('companies')
    .update({ name: 'Élégance Wax Lomé' })
    .eq('id', companyId)

  // 9. Invalidation systématique de tous les caches Next.js
  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/clients')
  revalidatePath('/dashboard/products')
  revalidatePath('/mes-livraisons')
  revalidatePath('/login')

  return { success: true }
}

export async function purgeAllAndSignOut(): Promise<{
  success?: boolean
  error?: string
}> {
  const res = await resetOperationalDataForTest()
  if (res.error) return res

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const profile = await getOrCreateProfile(supabase, user)
    if (profile.company_id) {
      await supabase
        .from('profiles')
        .delete()
        .eq('company_id', profile.company_id)
        .neq('id', user.id)
    }
  }

  await supabase.auth.signOut()

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/settings')
  revalidatePath('/mes-livraisons')
  revalidatePath('/login')
  revalidatePath('/register')

  return { success: true }
}
