import type { SupabaseClient, User } from '@supabase/supabase-js'

export type ThemePalette = 'indigo' | 'emerald' | 'terracotta'

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

export async function getOrCreateProfile(
  supabase: SupabaseClient,
  user: User
): Promise<UserProfile> {
  const existing = await selectProfile(supabase, user.id)
  if (existing) {
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
    return created
  }

  return {
    full_name: fallbackName,
    role: 'owner',
    company_id: '',
    companies: { name: fallbackCompany, logo_url: null, theme_palette: 'indigo' },
    profileMissing: true,
  }
}
