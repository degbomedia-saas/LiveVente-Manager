export type UserRole = 'owner' | 'employee' | 'courier' | 'super_admin'

export type ThemePalette = 'indigo' | 'emerald' | 'terracotta'

export type SubscriptionPlanType = 'trial' | 'starter' | 'pro' | 'enterprise'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'

export interface CompanyRow {
  id: string
  name: string
  slug: string
  country: string | null
  currency: string | null
  logo_url: string | null
  theme_palette: ThemePalette | null
  created_at: string
  updated_at: string
}

export interface ProfileRow {
  id: string
  company_id: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  email?: string | null
  zone?: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionRow {
  id: string
  company_id: string
  plan_type: SubscriptionPlanType
  status: SubscriptionStatus
  trial_starts_at: string
  trial_ends_at: string
  current_period_starts_at: string
  current_period_ends_at: string
  monthly_price: number
  payment_method: string | null
  created_at: string
  updated_at: string
}

export type SubscriptionSummary = Pick<
  SubscriptionRow,
  | 'status'
  | 'plan_type'
  | 'trial_ends_at'
  | 'current_period_ends_at'
  | 'monthly_price'
>
