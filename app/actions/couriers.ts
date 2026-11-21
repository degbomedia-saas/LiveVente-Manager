'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateProfile } from '@/lib/supabase/ensure-profile'

const inviteCourierSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Le prénom et nom doivent contenir au moins 2 caractères.')
    .max(100),
  phone: z
    .string()
    .trim()
    .min(8, 'Le téléphone WhatsApp doit contenir au moins 8 chiffres.')
    .max(25),
  email: z
    .string()
    .trim()
    .email('Adresse email invalide.')
    .max(255),
  zone: z.string().trim().max(120).optional().or(z.literal('')),
})

export type InviteCourierInput = z.infer<typeof inviteCourierSchema>

export async function inviteCourier(rawData: InviteCourierInput) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Non authentifié. Veuillez vous reconnecter.' }
  }

  const parsed = inviteCourierSchema.safeParse(rawData)
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

  const cleanName = parsed.data.fullName.trim()
  const cleanPhone = parsed.data.phone.trim()
  const cleanEmail = parsed.data.email.trim().toLowerCase()
  const cleanZone = parsed.data.zone?.trim() || null

  // 1. Insertion avec colonnes d'invitation (si migration 014 appliquée)
  let createdCourier: {
    id: string
    full_name: string
    phone: string | null
    is_active: boolean
    created_at: string
    email?: string | null
    zone?: string | null
    invitation_status?: string | null
  } | null = null

  const { data: fullInsert, error: fullErr } = await supabase
    .from('profiles')
    .insert({
      company_id: profile.company_id,
      full_name: cleanName,
      phone: cleanPhone,
      role: 'courier',
      is_active: true,
      email: cleanEmail,
      zone: cleanZone,
      invitation_status: 'pending',
    })
    .select('id, full_name, phone, is_active, created_at, email, zone, invitation_status')
    .single()

  if (!fullErr && fullInsert) {
    createdCourier = fullInsert
  } else {
    // Repli sans colonnes 014 (compatibilité immédiate)
    const { data: basicInsert, error: basicErr } = await supabase
      .from('profiles')
      .insert({
        company_id: profile.company_id,
        full_name: cleanName,
        phone: cleanPhone,
        role: 'courier',
        is_active: true,
      })
      .select('id, full_name, phone, is_active, created_at')
      .single()

    if (!basicErr && basicInsert) {
      createdCourier = {
        ...basicInsert,
        email: cleanEmail,
        zone: cleanZone,
        invitation_status: 'pending',
      }
    } else {
      // Dernier repli via RPC 004 sans mot de passe
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_courier_profile', {
        p_full_name: cleanName,
        p_phone: cleanPhone,
        p_is_active: true,
        p_email: null,
        p_password: null,
      })

      const rpcPayload = rpcRes as { success?: boolean; courier_id?: string; error?: string } | null
      if (rpcErr || !rpcPayload?.success || !rpcPayload.courier_id) {
        return {
          error:
            rpcPayload?.error ||
            basicErr?.message ||
            fullErr?.message ||
            'Impossible de créer le livreur.',
        }
      }

      const { data: fetched } = await supabase
        .from('profiles')
        .select('id, full_name, phone, is_active, created_at')
        .eq('id', rpcPayload.courier_id)
        .single()

      if (fetched) {
        createdCourier = {
          ...fetched,
          email: cleanEmail,
          zone: cleanZone,
          invitation_status: 'pending',
        }
      }
    }
  }

  if (!createdCourier) {
    return { error: 'Erreur lors de la création du profil livreur.' }
  }

  const params = new URLSearchParams({
    cid: createdCourier.id,
    email: cleanEmail,
    name: cleanName,
  })
  if (cleanZone) params.set('zone', cleanZone)

  const activationPath = `/first-login?${params.toString()}`

  revalidatePath('/dashboard/couriers')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/packing')

  return {
    success: true as const,
    courier: createdCourier,
    activationPath,
  }
}

export async function activateCourierAccount(params: {
  invitedProfileId?: string | null
  email?: string | null
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Session non active.' }
  }

  // Appeler la fonction SQL de liaison sécurisée si disponible
  const { error: rpcErr } = await supabase.rpc('link_courier_auth_account', {
    p_invited_profile_id: params.invitedProfileId || null,
    p_email: params.email || user.email || null,
  })

  if (rpcErr) {
    console.warn('link_courier_auth_account fallback:', rpcErr.message)
  }

  revalidatePath('/mes-livraisons')
  revalidatePath('/dashboard/couriers')
  revalidatePath('/dashboard/settings')

  return { success: true as const }
}
