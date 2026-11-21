'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SubscriptionStatus } from '@/types/database.types'

const ALLOWED_STATUSES: SubscriptionStatus[] = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired',
]

async function assertSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié.' as const, supabase: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'super_admin') {
    return { error: 'Accès strictement réservé au super_admin.' as const, supabase: null }
  }

  return { error: null, supabase }
}

export async function extendSubscription(storeId: string, days: number = 30) {
  const { error: authError, supabase } = await assertSuperAdmin()
  if (authError || !supabase) {
    return { success: false, error: authError ?? 'Accès refusé.' }
  }

  if (!storeId || days <= 0) {
    return { success: false, error: 'Paramètres invalides.' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('subscriptions')
    .select('id, current_period_ends_at, status')
    .eq('company_id', storeId)
    .maybeSingle()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const now = new Date()
  const existingEnd = existing?.current_period_ends_at
    ? new Date(existing.current_period_ends_at)
    : null

  const baseDate = existingEnd && existingEnd > now ? existingEnd : now
  const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

  if (existing) {
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        current_period_starts_at:
          existingEnd && existingEnd > now ? undefined : now.toISOString(),
        current_period_ends_at: newEnd.toISOString(),
      })
      .eq('company_id', storeId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }
  } else {
    const { error: insertError } = await supabase.from('subscriptions').insert({
      company_id: storeId,
      plan_type: 'starter',
      status: 'active',
      trial_starts_at: now.toISOString(),
      trial_ends_at: now.toISOString(),
      current_period_starts_at: now.toISOString(),
      current_period_ends_at: newEnd.toISOString(),
      monthly_price: 15000,
      payment_method: 'tmoney_moov',
    })

    if (insertError) {
      return { success: false, error: insertError.message }
    }
  }

  revalidatePath('/super-admin')
  return { success: true, newEnd: newEnd.toISOString() }
}

export async function toggleStoreStatus(
  storeId: string,
  status: SubscriptionStatus
) {
  const { error: authError, supabase } = await assertSuperAdmin()
  if (authError || !supabase) {
    return { success: false, error: authError ?? 'Accès refusé.' }
  }

  if (!storeId || !ALLOWED_STATUSES.includes(status)) {
    return { success: false, error: 'Statut ou boutique invalide.' }
  }

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({ status })
    .eq('company_id', storeId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath('/super-admin')
  return { success: true }
}
