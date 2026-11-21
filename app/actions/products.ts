'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import {
  productSchema,
  updateProductSchema,
  type ProductInput,
  type UpdateProductInput,
} from '@/lib/validations/products'

function parseTagList(raw?: string): string[] {
  if (!raw) return []
  const unique = new Set<string>()
  for (const part of raw.split(',')) {
    const val = part.trim()
    if (val) unique.add(val)
  }
  return Array.from(unique)
}

export async function createProduct(rawData: ProductInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const parsed = productSchema.safeParse(rawData)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, field: first.path[0] as string | undefined }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'owner' && profile.role !== 'employee') {
    return { error: 'Action non autorisée.' }
  }

  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert({
      company_id: profile.company_id,
      name: parsed.data.name,
      base_price: parsed.data.basePrice,
      available_sizes: parseTagList(parsed.data.sizesInput),
      available_colors: parseTagList(parsed.data.colorsInput),
    })
    .select('id, name, base_price, available_sizes, available_colors, is_active, created_at')
    .single()

  if (insertError || !product) {
    return {
      error:
        'Erreur lors de l\'enregistrement. Vérifiez que supabase/migrations/006_products_catalog.sql est exécuté dans Supabase.',
    }
  }

  revalidatePath('/produits')
  revalidatePath('/dashboard/products')
  revalidatePath('/commandes')
  revalidatePath('/dashboard/orders')
  return { success: true as const, product }
}

export async function updateProduct(rawData: UpdateProductInput) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Non authentifié.' }
  }

  const parsed = updateProductSchema.safeParse(rawData)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first.message, field: first.path[0] as string | undefined }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (profile.profileMissing || !profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  if (profile.role !== 'owner' && profile.role !== 'employee') {
    return { error: 'Action non autorisée.' }
  }

  const { data: product, error: updateError } = await supabase
    .from('products')
    .update({
      name: parsed.data.name,
      base_price: parsed.data.basePrice,
      available_sizes: parseTagList(parsed.data.sizesInput),
      available_colors: parseTagList(parsed.data.colorsInput),
    })
    .eq('id', parsed.data.id)
    .eq('company_id', profile.company_id)
    .select('id, name, base_price, available_sizes, available_colors, is_active, created_at')
    .single()

  if (updateError || !product) {
    return { error: 'Impossible de modifier ce produit.' }
  }

  revalidatePath('/produits')
  revalidatePath('/dashboard/products')
  revalidatePath('/commandes')
  revalidatePath('/dashboard/orders')
  return { success: true as const, product }
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
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

  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', productId)
    .eq('company_id', profile.company_id)

  if (error) {
    return { error: 'Impossible de modifier le statut du produit.' }
  }

  revalidatePath('/produits')
  revalidatePath('/dashboard/products')
  revalidatePath('/commandes')
  revalidatePath('/dashboard/orders')
  return { success: true }
}
