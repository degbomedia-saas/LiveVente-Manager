'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import {
  createSettlementSchema,
  type CreateSettlementInput,
} from '@/lib/validations/payments'

export async function createCourierSettlement(rawData: CreateSettlementInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const parsed = createSettlementSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Action non autorisée. Seul le propriétaire peut enregistrer un reversement.' }
  }

  const { data: courier, error: courierError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', parsed.data.courierId)
    .eq('company_id', profile.company_id)
    .eq('role', 'courier')
    .single()

  if (courierError || !courier) {
    return { error: 'Livreur introuvable pour votre entreprise.' }
  }

  const { count: deliveredCount } = await supabase
    .from('deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', profile.company_id)
    .eq('courier_id', courier.id)
    .eq('status', 'delivered')

  const today = new Date().toISOString().slice(0, 10)

    const diffAmount = parsed.data.differenceAmount ?? 0
    const diffReason = diffAmount !== 0 ? (parsed.data.differenceReason?.trim() || null) : null

    const { error: insertError } = await supabase
      .from('courier_settlements')
      .insert({
        company_id: profile.company_id,
        courier_id: courier.id,
        amount: parsed.data.amount,
        status: 'paid',
        period_start: today,
        period_end: today,
        deliveries_count: deliveredCount ?? 0,
        paid_at: new Date().toISOString(),
        difference_amount: diffAmount,
        difference_reason: diffReason,
        notes: parsed.data.notes || null,
      })

  if (insertError) {
    return { error: 'Erreur lors de l\'enregistrement du reversement.' }
  }

  revalidatePath('/paiements')
  revalidatePath('/dashboard/payments')
  return { success: true as const }
}
