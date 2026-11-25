import type { SupabaseClient, User } from '@supabase/supabase-js'

export type ThemePalette =
  | 'emerald'
  | 'sky'
  | 'coral'
  | 'violet'
  | 'indigo'
  | 'terracotta'

export interface UserProfile {
  full_name: string
  role: string
  company_id: string
  companies: {
    name: string
    logo_url?: string | null
    theme_palette?: ThemePalette | null
  } | null
  profileMissing?: boolean
}

async function selectProfile(supabase: SupabaseClient, userId: string): Promise<UserProfile | null> {
  const { data: full, error: fullErr } = await supabase
    .from('profiles')
    .select('full_name, role, company_id, companies(name, logo_url, theme_palette)')
    .eq('id', userId)
    .single<UserProfile>()

  if (!fullErr && full) {
    return full
  }

  const { data: basic } = await supabase
    .from('profiles')
    .select('full_name, role, company_id, companies(name)')
    .eq('id', userId)
    .single<UserProfile>()

  return basic ?? null
}

export const FOUNDER_SUPER_ADMIN_EMAIL = 'degbomedia@gmail.com'

export function isFounderSuperAdminEmail(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === FOUNDER_SUPER_ADMIN_EMAIL
}

export async function getOrCreateProfile(
  supabase: SupabaseClient,
  user: User
): Promise<UserProfile> {
  const isFounder = isFounderSuperAdminEmail(user.email)
  const existing = await selectProfile(supabase, user.id)
  if (existing) {
    if (isFounder && existing.role !== 'super_admin') {
      await supabase
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', user.id)
      return { ...existing, role: 'super_admin' }
    }
    return existing
  }

  const fallbackName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    'Utilisateur'
  const fallbackCompany =
    (user.user_metadata?.company_name as string | undefined)?.trim() ||
    `Entreprise de ${fallbackName}`

  await supabase.rpc('create_company_and_profile', {
    p_full_name: fallbackName,
    p_company_name: fallbackCompany,
  })

  const created = await selectProfile(supabase, user.id)
  if (created) {
    if (isFounder && created.role !== 'super_admin') {
      await supabase
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', user.id)
      return { ...created, role: 'super_admin' }
    }
    return created
  }

  return {
    full_name: fallbackName,
    role: isFounder ? 'super_admin' : 'owner',
    company_id: '',
    companies: { name: fallbackCompany, logo_url: null, theme_palette: 'indigo' },
    profileMissing: true,
  }
}
