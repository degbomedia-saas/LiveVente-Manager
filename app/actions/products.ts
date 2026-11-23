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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
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

  const { data: storeRow } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  const fullPayload = {
    company_id: profile.company_id,
    seller_id: storeRow?.id ?? null,
    name: parsed.data.name,
    base_price: parsed.data.basePrice,
    price_fcfa: Math.round(parsed.data.basePrice),
    sku: parsed.data.sku || null,
    category: parsed.data.category || 'Mode',
    stock_qty: parsed.data.stockQty ?? 10,
    low_stock_threshold: parsed.data.lowStockThreshold ?? 3,
    image_url: parsed.data.imageUrl || null,
    available_sizes: parseTagList(parsed.data.sizesInput),
    available_colors: parseTagList(parsed.data.colorsInput),
  }

  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert(fullPayload)
    .select(
      'id, name, base_price, price_fcfa, sku, category, stock_qty, low_stock_threshold, image_url, available_sizes, available_colors, is_active, created_at'
    )
    .maybeSingle()

  if (!insertError && product) {
    revalidatePath('/produits')
    revalidatePath('/dashboard/products')
    revalidatePath('/commandes')
    revalidatePath('/dashboard/orders')
    return { success: true as const, product }
  }

  // Repli si la migration 019 n'est pas encore appliquée en base
  const { data: baseProduct, error: baseError } = await supabase
    .from('products')
    .insert({
      company_id: profile.company_id,
      name: parsed.data.name,
      base_price: parsed.data.basePrice,
      available_sizes: parseTagList(parsed.data.sizesInput),
      available_colors: parseTagList(parsed.data.colorsInput),
    })
    .select(
      'id, name, base_price, available_sizes, available_colors, is_active, created_at'
    )
    .single()

  if (baseError || !baseProduct) {
    return {
      error: "Erreur lors de l'enregistrement du produit.",
    }
  }

  revalidatePath('/produits')
  revalidatePath('/dashboard/products')
  revalidatePath('/commandes')
  revalidatePath('/dashboard/orders')
  return {
    success: true as const,
    product: {
      ...baseProduct,
      price_fcfa: Math.round(parsed.data.basePrice),
      sku: parsed.data.sku || null,
      category: parsed.data.category || 'Mode',
      stock_qty: parsed.data.stockQty ?? 10,
      low_stock_threshold: parsed.data.lowStockThreshold ?? 3,
      image_url: parsed.data.imageUrl || null,
    },
  }
}

export async function updateProduct(rawData: UpdateProductInput) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
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

  const { data: product, error: updateError } = await supabase
    .from('products')
    .update({
      name: parsed.data.name,
      base_price: parsed.data.basePrice,
      price_fcfa: Math.round(parsed.data.basePrice),
      sku: parsed.data.sku || null,
      category: parsed.data.category || 'Mode',
      stock_qty: parsed.data.stockQty ?? 10,
      low_stock_threshold: parsed.data.lowStockThreshold ?? 3,
      image_url: parsed.data.imageUrl || null,
      available_sizes: parseTagList(parsed.data.sizesInput),
      available_colors: parseTagList(parsed.data.colorsInput),
    })
    .eq('id', parsed.data.id)
    .eq('company_id', profile.company_id)
    .select(
      'id, name, base_price, price_fcfa, sku, category, stock_qty, low_stock_threshold, image_url, available_sizes, available_colors, is_active, created_at'
    )
    .maybeSingle()

  if (!updateError && product) {
    revalidatePath('/produits')
    revalidatePath('/dashboard/products')
    revalidatePath('/commandes')
    revalidatePath('/dashboard/orders')
    return { success: true as const, product }
  }

  // Repli sans les colonnes 019
  const { data: baseProduct, error: baseErr } = await supabase
    .from('products')
    .update({
      name: parsed.data.name,
      base_price: parsed.data.basePrice,
      available_sizes: parseTagList(parsed.data.sizesInput),
      available_colors: parseTagList(parsed.data.colorsInput),
    })
    .eq('id', parsed.data.id)
    .eq('company_id', profile.company_id)
    .select(
      'id, name, base_price, available_sizes, available_colors, is_active, created_at'
    )
    .single()

  if (baseErr || !baseProduct) {
    return { error: 'Impossible de modifier ce produit.' }
  }

  revalidatePath('/produits')
  revalidatePath('/dashboard/products')
  revalidatePath('/commandes')
  revalidatePath('/dashboard/orders')
  return {
    success: true as const,
    product: {
      ...baseProduct,
      price_fcfa: Math.round(parsed.data.basePrice),
      sku: parsed.data.sku || null,
      category: parsed.data.category || 'Mode',
      stock_qty: parsed.data.stockQty ?? 10,
      low_stock_threshold: parsed.data.lowStockThreshold ?? 3,
      image_url: parsed.data.imageUrl || null,
    },
  }
}

export async function toggleProductActive(productId: string, isActive: boolean) {
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

export async function toggleProductShowInLive(
  productId: string,
  showInLive: boolean
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  if (!profile.company_id) {
    return { error: 'Profil introuvable.' }
  }

  await supabase
    .from('products')
    .update({ show_in_live: showInLive })
    .eq('id', productId)
    .eq('company_id', profile.company_id)

  revalidatePath('/dashboard/products')
  return { success: true as const }
}
