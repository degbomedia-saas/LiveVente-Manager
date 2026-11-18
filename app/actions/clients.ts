'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
    const firstError = result.error.errors[0]
    return { error: firstError.message, field: firstError.path[0] as string }
  }

  // 3. Récupérer company_id et rôle CÔTÉ SERVEUR (jamais depuis le client)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { error: 'Profil introuvable. Veuillez vous reconnecter.' }
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
