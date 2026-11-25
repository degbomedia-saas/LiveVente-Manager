'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'
import { DEFAULT_LOME_ZONES } from '@/lib/config/lome-zones'
import type { DeliveryZoneRow, StorePaletteKey, StoreRow } from '@/types/database.types'

const onboardingSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, 'Le nom de la boutique doit contenir au moins 2 caractères.')
    .max(100, 'Le nom est trop long.'),
  whatsappPhone: z
    .string()
    .trim()
    .min(8, 'Veuillez saisir votre numéro WhatsApp (+228) complet.')
    .max(30, 'Numéro trop long.')
    .refine((val) => {
      const digits = val.replace(/\D/g, '')
      const localDigits =
        digits.startsWith('228') && digits.length > 8
          ? digits.slice(3)
          : digits === '228'
            ? ''
            : digits
      return localDigits.length >= 8
    }, 'Le numéro WhatsApp (+228) est obligatoire (8 chiffres minimum).'),
  city: z.string().trim().min(2, 'Veuillez indiquer la ville ou le quartier.').max(80),
  paletteKey: z.enum(['emerald', 'sky', 'coral', 'violet']),
  logoUrl: z.string().trim().max(2_500_000).nullable().optional(),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>

export async function completeSellerOnboarding(rawInput: OnboardingInput) {
  const parsed = onboardingSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié. Veuillez vous connecter.' }
  }

  const profile = await getOrCreateProfile(supabase, user)
  const { storeName, whatsappPhone, city, paletteKey, logoUrl } = parsed.data

  // 1. Synchroniser public.companies (compatibilité avec toutes les vues existantes)
  if (profile.company_id) {
    const { error: compErr } = await supabase
      .from('companies')
      .update({
        name: storeName,
        phone: whatsappPhone,
        city,
        logo_url: logoUrl ?? null,
        theme_palette: paletteKey,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.company_id)

    if (compErr) {
      await supabase
        .from('companies')
        .update({
          name: storeName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.company_id)
    }
  }

  // 2. Créer ou mettre à jour la boutique dans public.stores
  const { data: storeRow, error: storeErr } = await supabase
    .from('stores')
    .upsert(
      {
        owner_id: user.id,
        company_id: profile.company_id || null,
        store_name: storeName,
        whatsapp_phone: whatsappPhone,
        city,
        logo_url: logoUrl ?? null,
        palette_key: paletteKey,
        plan: 'free_mvp',
        plan_status: 'trial',
        loyalty_threshold: 5,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id' }
    )
    .select('id')
    .maybeSingle()

  // 3. Copier automatiquement les 5 zones de livraison par défaut pour Lomé si absentes
  if (!storeErr && storeRow?.id) {
    const { data: existingZones } = await supabase
      .from('delivery_zones')
      .select('id')
      .eq('seller_id', storeRow.id)
      .limit(1)

    if (!existingZones || existingZones.length === 0) {
      await supabase.from('delivery_zones').insert(
        DEFAULT_LOME_ZONES.map((z) => ({
          seller_id: storeRow.id,
          zone_name: z.zone_name,
          fee_fcfa: z.fee_fcfa,
          is_active: z.is_active,
        }))
      )
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/onboarding')

  return { success: true as const }
}

const zoneInputSchema = z.object({
  id: z.string().optional(),
  zone_name: z.string().trim().min(1, 'Nom de zone requis').max(80),
  fee_fcfa: z.number().int().min(0, 'Tarif invalide'),
  is_active: z.boolean(),
})

const saveZonesSchema = z.object({
  zones: z.array(zoneInputSchema).min(1, 'Au moins une zone est requise.'),
})

export async function saveSellerDeliveryZones(rawInput: {
  zones: Array<{
    id?: string
    zone_name: string
    fee_fcfa: number
    is_active: boolean
  }>
}) {
  const parsed = saveZonesSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Zones invalides.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié.' }
  }

  const profile = await getOrCreateProfile(supabase, user)

  // S'assurer que la ligne stores existe pour ce vendeur
  let { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!store) {
    const { data: created } = await supabase
      .from('stores')
      .upsert(
        {
          owner_id: user.id,
          company_id: profile.company_id || null,
          store_name: profile.companies?.name || 'Ma Boutique',
          city: 'Lomé',
          palette_key: 'emerald',
        },
        { onConflict: 'owner_id' }
      )
      .select('id')
      .maybeSingle()
    store = created ?? null
  }

  if (!store?.id) {
    return {
      error:
        'Table public.stores non trouvée. Exécutez la migration 018 dans Supabase.',
    }
  }

  // Remplacer proprement la liste des zones du vendeur
  await supabase.from('delivery_zones').delete().eq('seller_id', store.id)

  const { error: insertErr } = await supabase.from('delivery_zones').insert(
    parsed.data.zones.map((z) => ({
      seller_id: store.id,
      zone_name: z.zone_name,
      fee_fcfa: z.fee_fcfa,
      is_active: z.is_active,
    }))
  )

  if (insertErr) {
    return { error: insertErr.message }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/orders')
  return { success: true as const }
}

export async function getSellerStoreAndZones(): Promise<{
  store: StoreRow | null
  zones: DeliveryZoneRow[]
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { store: null, zones: [] }
  }

  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (storeErr || !store) {
    return {
      store: null,
      zones: DEFAULT_LOME_ZONES.map((z, idx) => ({
        id: `default-${idx}`,
        seller_id: '',
        zone_name: z.zone_name,
        fee_fcfa: z.fee_fcfa,
        is_active: z.is_active,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
    }
  }

  const { data: zones } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('seller_id', store.id)
    .order('created_at', { ascending: true })

  return {
    store: store as StoreRow,
    zones:
      zones && zones.length > 0
        ? (zones as DeliveryZoneRow[])
        : DEFAULT_LOME_ZONES.map((z, idx) => ({
            id: `default-${idx}`,
            seller_id: store.id,
            zone_name: z.zone_name,
            fee_fcfa: z.fee_fcfa,
            is_active: z.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })),
  }
}

export type { StorePaletteKey }
