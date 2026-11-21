'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { companySettingsSchema, type CompanySettingsInput } from '@/lib/validations/settings'

const brandingSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Le nom de la boutique doit contenir au moins 2 caractères.')
    .max(100, 'Le nom est trop long.'),
  logoUrl: z.string().trim().max(2_500_000, 'Le logo est trop volumineux.').nullable().optional(),
  themePalette: z.enum(['indigo', 'emerald', 'terracotta']),
})

export type BrandingSettingsInput = z.infer<typeof brandingSettingsSchema>

export async function updateBrandingSettings(rawData: BrandingSettingsInput) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const parsed = brandingSettingsSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil ou entreprise introuvable.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Seul le propriétaire de la boutique peut modifier la marque.' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      name: parsed.data.name,
      logo_url: parsed.data.logoUrl ?? null,
      theme_palette: parsed.data.themePalette,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.company_id)

  if (error) {
    console.warn('Erreur mise à jour branding complète:', error.message)
    const { error: fallbackErr } = await supabase
      .from('companies')
      .update({
        name: parsed.data.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.company_id)

    if (fallbackErr) {
      return { error: 'Erreur lors de la mise à jour de la boutique.' }
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')
  revalidatePath('/dashboard/payments')
  revalidatePath('/dashboard/couriers')
  revalidatePath('/mes-livraisons')
  return { success: true as const }
}

export async function updateCompanySettings(rawData: CompanySettingsInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const parsed = companySettingsSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil ou entreprise introuvable.' }
  }

  if (profile.role !== 'owner') {
    return { error: 'Seul le propriétaire de la boutique peut modifier les paramètres.' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      currency: parsed.data.currency || 'XOF',
      city: parsed.data.city || null,
      address: parsed.data.address || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.company_id)

  if (error) {
    // Si l'erreur est liée à une colonne manquante dans l'instance Supabase (migration 011 non encore exécutée dans SQL Editor),
    // mise à jour de repli sur le nom et la devise
    console.warn('Erreur mise à jour companies complète:', error.message)
    const { error: fallbackError } = await supabase
      .from('companies')
      .update({
        name: parsed.data.name,
        currency: parsed.data.currency || 'XOF',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.company_id)

    if (fallbackError) {
      console.error('Erreur mise à jour companies fallback:', fallbackError.message)
      return { error: 'Erreur lors de la mise à jour des paramètres.' }
    }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/orders')
  return { success: true }
}
